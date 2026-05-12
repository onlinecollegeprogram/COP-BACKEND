import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Leads from "../../models/Leads.js"
import { sendEmail } from "../../lib/mail.js"
import { optionalStudentAuth } from "../../middleware/studentAuth.js"

const router = Router()

// POST /api/public/leads — handle both general leads and "Talk to Expert" requests
/**
 * @openapi
 * /api/public/leads:
 *   post:
 *     tags: [Public - Leads]
 *     summary: Submit a new lead (general or "Talk to Expert")
 *     description: |
 *       Public endpoint for capturing leads from the website. Uses optional student auth — if
 *       a student bearer token is supplied, the lead is auto-filled from the student record
 *       and tagged with their student id in metadata. Sends an admin notification email
 *       (failure to send email does not fail the request).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, description: "Required if no logged-in student." }
 *               email: { type: string, format: email, description: "Required if no logged-in student." }
 *               phone: { type: string, description: "Required if no logged-in student." }
 *               courseOfInterest: { type: string }
 *               message: { type: string }
 *               source:
 *                 type: string
 *                 description: 'Form source identifier; "talk_to_experts" triggers Talk-to-Expert flow.'
 *                 example: website_form
 *     responses:
 *       201:
 *         description: Lead created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 lead: { $ref: '#/components/schemas/Lead' }
 *       400:
 *         description: Missing required fields or invalid email format
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.post("/", optionalStudentAuth, async (req, res) => {
  try {
    await connectDB()
    const body = req.body

    // Core Logic: Always prioritize logged-in student credentials
    const name = req.student?.name || body.name
    const email = req.student?.email || body.email
    const phone = req.student?.phone || body.phone

    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Name, email, and phone are required" })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" })
    }

    // Create lead with injected metadata if student is logged in
    const lead = await Leads.create({
      name,
      email,
      phone,
      courseOfInterest: body.courseOfInterest || req.student?.courseOfInterest || "",
      message: body.message || (body.source === "talk_to_experts" ? "Talk to Experts Request" : ""),
      source: body.source || "website_form",
      metadata: {
        studentId: req.student?._id || null,
        isStudentLoggedIn: !!req.student,
      },
    })

    // Notify Admin via Email
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || "admin@example.com"
      const isTalkToExpert = body.source === "talk_to_experts"

      await sendEmail({
        to: adminEmail,
        subject: `${isTalkToExpert ? "[Talk to Expert]" : "[New Lead]"} from ${lead.name}`,
        html: `
          <h3>${isTalkToExpert ? "Talk to Experts Request" : "New Website Lead"}</h3>
          <p>A new lead has been generated.</p>
          <hr />
          <p><strong>Name:</strong> ${lead.name}</p>
          <p><strong>Email:</strong> ${lead.email}</p>
          <p><strong>Phone:</strong> ${lead.phone}</p>
          <p><strong>Course of Interest:</strong> ${lead.courseOfInterest || "Not specified"}</p>
          <p><strong>Source:</strong> ${lead.source}</p>
          <p><strong>Student Status:</strong> ${req.student ? "LoggedIn (ID: " + req.student._id + ")" : "Guest"}</p>
          <hr />
          <p><strong>Message:</strong></p>
          <p>${lead.message || "No message provided"}</p>
          <hr />
          <p>View this lead in the Admin Dashboard.</p>
        `
      })
    } catch (mailErr) {
      console.error("Lead notification email failed:", mailErr.message)
    }

    res.status(201).json({ success: true, lead })
  } catch (err) {
    console.error("Error creating lead:", err)
    res.status(500).json({ error: "Failed to process lead", details: err.message })
  }
})

export default router
