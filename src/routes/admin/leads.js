import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Leads from "../../models/Leads.js"
import { logActivity } from "../../lib/activityLogger.js"
import { getClerkUserInfo } from "../../lib/clerkHelper.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

/**
 * @openapi
 * /api/admin/leads:
 *   get:
 *     tags: [Admin - Leads]
 *     summary: List leads
 *     description: Returns leads sorted newest-first. Optionally filter by `callStatus` via the `status` query param.
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Filter by `callStatus` (e.g. "new", "contacted", "qualified", "converted")
 *     responses:
 *       200:
 *         description: Array of leads
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Lead' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/leads
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const query = {}
    if (req.query.status) query.callStatus = req.query.status

    const leads = await Leads.find(query).sort({ createdAt: -1 })
    res.json(leads)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leads", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/leads:
 *   post:
 *     tags: [Admin - Leads]
 *     summary: Create a lead (admin-side)
 *     description: Admin counterpart of the public lead form. Requires name, email, and phone.
 *     security:
 *       - clerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               courseOfInterest: { type: string }
 *               message: { type: string }
 *               source: { type: string, default: website_form }
 *     responses:
 *       201:
 *         description: Lead created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Lead' }
 *       400:
 *         description: Missing name/email/phone
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/leads (admin can also create)
router.post("/", async (req, res) => {
  try {
    await connectDB()
    const body = req.body

    if (!body.name || !body.email || !body.phone) {
      return res.status(400).json({ error: "Name, email, and phone are required" })
    }

    const lead = await Leads.create({
      name: body.name,
      email: body.email,
      phone: body.phone,
      courseOfInterest: body.courseOfInterest || "",
      message: body.message || "",
      source: body.source || "website_form",
    })

    res.status(201).json(lead)
  } catch (err) {
    res.status(500).json({ error: "Failed to create lead", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/leads/{id}:
 *   get:
 *     tags: [Admin - Leads]
 *     summary: Get a lead by ID
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead document
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Lead' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Lead not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/leads/:id
router.get("/:id", async (req, res) => {
  try {
    await connectDB()
    const lead = await Leads.findById(req.params.id)
    if (!lead) return res.status(404).json({ error: "Lead not found" })
    res.json(lead)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch lead", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/leads/{id}:
 *   put:
 *     tags: [Admin - Leads]
 *     summary: Update a lead
 *     description: Updates lead fields (e.g. `callStatus`, `assignedTo`, `notes`) and stamps `lastUpdated`.
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               callStatus: { type: string }
 *               assignedTo: { type: string }
 *               courseOfInterest: { type: string }
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Updated lead
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Lead' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Lead not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// PUT /api/admin/leads/:id
router.put("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const updated = await Leads.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdated: new Date() },
      { new: true }
    )
    if (!updated) return res.status(404).json({ error: "Lead not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "update", section: "leads",
      itemId: req.params.id, itemName: updated.name,
      details: `Updated lead: ${JSON.stringify(req.body)}`,
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: "Failed to update lead", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/leads/{id}:
 *   delete:
 *     tags: [Admin - Leads]
 *     summary: Delete a lead
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Lead not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/leads/:id
router.delete("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const deleted = await Leads.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: "Lead not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "delete", section: "leads",
      itemId: req.params.id, itemName: deleted.name,
      details: `Deleted lead`,
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete lead", details: err.message })
  }
})

export default router
