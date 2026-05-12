import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Review from "../../models/Review.js"
import { logActivity } from "../../lib/activityLogger.js"
import { getClerkUserInfo } from "../../lib/clerkHelper.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

/**
 * @openapi
 * /api/admin/reviews:
 *   get:
 *     tags: [Admin - Reviews]
 *     summary: List reviews
 *     description: Returns reviews newest-first with the provider populated (`name`, `slug`).
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: query
 *         name: providerId
 *         schema: { type: string }
 *         description: Filter reviews for a specific provider
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *         description: Filter by approval state
 *     responses:
 *       200:
 *         description: Array of reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Review' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/reviews
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const query = {}
    if (req.query.providerId) query.providerId = req.query.providerId
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === "true"

    const reviews = await Review.find(query)
      .populate("providerId", "name slug")
      .sort({ createdAt: -1 })

    res.json(reviews)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reviews", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/reviews:
 *   post:
 *     tags: [Admin - Reviews]
 *     summary: Create a review (admin)
 *     description: Creates a review with `isActive=false` (pending moderation). All listed fields are required.
 *     security:
 *       - clerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, providerId, rating, title, comment]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               providerId: { type: string }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               title: { type: string }
 *               comment: { type: string }
 *     responses:
 *       201:
 *         description: Review created (inactive by default)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Review' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/reviews
router.post("/", async (req, res) => {
  try {
    await connectDB()
    const body = req.body

    if (!body.name || !body.email || !body.providerId || !body.rating || !body.title || !body.comment) {
      return res.status(400).json({ error: "All fields are required" })
    }

    const review = await Review.create({ ...body, isActive: false })
    res.status(201).json(review)
  } catch (err) {
    res.status(500).json({ error: "Failed to create review", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/reviews/{id}:
 *   get:
 *     tags: [Admin - Reviews]
 *     summary: Get a review by ID
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review document (provider populated)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Review' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Review not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/reviews/:id
router.get("/:id", async (req, res) => {
  try {
    await connectDB()
    const review = await Review.findById(req.params.id).populate("providerId", "name slug")
    if (!review) return res.status(404).json({ error: "Review not found" })
    res.json(review)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch review", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/reviews/{id}:
 *   put:
 *     tags: [Admin - Reviews]
 *     summary: Update a review (typically moderation — toggling `isActive`)
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
 *               isActive: { type: boolean }
 *               title: { type: string }
 *               comment: { type: string }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *     responses:
 *       200:
 *         description: Updated review (provider populated)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Review' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Review not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// PUT /api/admin/reviews/:id
router.put("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const updated = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate("providerId", "name slug")
    if (!updated) return res.status(404).json({ error: "Review not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "update", section: "reviews",
      itemId: req.params.id, itemName: updated.title,
      details: `Updated review`,
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: "Failed to update review", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/reviews/{id}:
 *   delete:
 *     tags: [Admin - Reviews]
 *     summary: Delete a review
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Review not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/reviews/:id
router.delete("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const deleted = await Review.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: "Review not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "delete", section: "reviews",
      itemId: req.params.id, itemName: deleted.title,
      details: `Deleted review`,
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete review", details: err.message })
  }
})

export default router
