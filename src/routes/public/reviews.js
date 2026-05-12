import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Review from "../../models/Review.js"
import { sendEmail } from "../../lib/mail.js"

const router = Router()

/**
 * @route   POST /api/public/reviews
 * @desc    Submit a new review (pending approval)
 * @access  Public
 */
/**
 * @openapi
 * /api/public/reviews:
 *   post:
 *     tags: [Public - Reviews]
 *     summary: Submit a new review (held for moderation)
 *     description: |
 *       Submitted reviews are created with `isActive: false` and become visible only after
 *       an admin approves them. An admin notification email is sent fire-and-forget after the response.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [providerId, name, email, rating, title, comment]
 *             properties:
 *               providerId: { type: string }
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               title: { type: string }
 *               comment: { type: string }
 *     responses:
 *       201:
 *         description: Review submitted (pending moderation)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 review: { $ref: '#/components/schemas/Review' }
 *       400:
 *         description: Missing fields or rating out of range
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.post("/", async (req, res) => {
    try {
        await connectDB()
        const { providerId, name, email, rating, title, comment } = req.body

        // Basic validation
        if (!providerId || !name || !email || !rating || !title || !comment) {
            return res.status(400).json({ error: "All fields are required" })
        }

        // Rating validation
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5" })
        }

        const review = await Review.create({
            providerId,
            name,
            email,
            rating,
            title,
            comment,
            isActive: false, // Reviews are hidden until approved by admin
            source: "website_form",
        })

        // Respond immediately — don't make the user wait for email delivery
        res.status(201).json({
            success: true,
            message: "Review submitted successfully. It will be visible after moderation.",
            review,
        })

        // Notify Admin via Email (fire-and-forget, runs after response is sent)
        try {
            const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || "admin@example.com"
            sendEmail({
                to: adminEmail,
                subject: `New Review for Moderation: ${title}`,
                html: `
          <h3>New Review Received</h3>
          <p>A new student review has been submitted for moderation.</p>
          <hr />
          <p><strong>Reviewer:</strong> ${name} (${email})</p>
          <p><strong>Rating:</strong> ${rating}/5 ★</p>
          <p><strong>Title:</strong> ${title}</p>
          <p><strong>Comment:</strong></p>
          <p>${comment}</p>
          <hr />
          <p>This review is currently <strong>Inactive</strong>. Please log in to the Admin Dashboard to approve or delete it.</p>
        `
            }).catch(mailErr => {
                console.error("Failed to send review notification email:", mailErr.message)
            })
        } catch (mailErr) {
            console.error("Failed to send review notification email:", mailErr.message)
        }
    } catch (err) {
        console.error("Error submitting review:", err)
        res.status(500).json({ error: "Failed to submit review", details: err.message })
    }
})

/**
 * @route   GET /api/public/reviews
 * @desc    Get all active reviews
 * @access  Public
 */
/**
 * @openapi
 * /api/public/reviews:
 *   get:
 *     tags: [Public - Reviews]
 *     summary: List the 10 latest active reviews
 *     description: Returns up to 10 active reviews (newest first) with the related provider's `name` and `logo` populated.
 *     responses:
 *       200:
 *         description: Array of active reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Review' }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/", async (req, res) => {
    try {
        await connectDB()
        const reviews = await Review.find({ isActive: true })
            .populate("providerId", "name logo")
            .sort({ createdAt: -1 })
            .limit(10)
        
        res.json(reviews)
    } catch (err) {
        console.error("Error fetching reviews:", err)
        res.status(500).json({ error: "Failed to fetch reviews" })
    }
})

export default router

