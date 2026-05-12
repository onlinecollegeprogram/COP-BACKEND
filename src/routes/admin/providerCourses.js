import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import ProviderCourse from "../../models/ProviderCourse.js"
import { logActivity } from "../../lib/activityLogger.js"
import { getClerkUserInfo } from "../../lib/clerkHelper.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

const populate = (query) =>
  query.populate("degreeTypeId").populate("courseId").populate("specializationId")

/**
 * @openapi
 * /api/admin/provider-courses:
 *   get:
 *     tags: [Admin - Provider Courses]
 *     summary: List provider-course mappings
 *     description: Returns all mappings with populated `degreeTypeId`, `courseId`, and `specializationId`.
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Array of provider-course mappings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ProviderCourse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/provider-courses
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const entries = await populate(ProviderCourse.find())
    res.json(entries)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch provider courses", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/provider-courses:
 *   post:
 *     tags: [Admin - Provider Courses]
 *     summary: Create a provider-course mapping
 *     description: Forwards the request body to `ProviderCourse.create`. Refer to the model for the full list of accepted fields.
 *     security:
 *       - clerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/ProviderCourse'
 *               - type: object
 *                 properties:
 *                   degreeTypeId: { type: string }
 *                   title: { type: string }
 *     responses:
 *       201:
 *         description: Provider course created (populated)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProviderCourse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error (incl. validation), content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/provider-courses
router.post("/", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const entry = await ProviderCourse.create(req.body)
    await populate(ProviderCourse.findById(entry._id)).then((doc) => {
      Object.assign(entry, doc.toObject())
    })

    await logActivity({
      userId, userName, userEmail,
      action: "create", section: "provider-courses",
      itemId: entry._id, itemName: entry.title || "Provider Course",
      details: `Created new provider course`,
    })

    res.status(201).json(entry)
  } catch (err) {
    res.status(500).json({ error: "Failed to create provider course", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/provider-courses/{id}:
 *   get:
 *     tags: [Admin - Provider Courses]
 *     summary: Get a provider-course mapping by ID
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Provider course (populated)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProviderCourse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Provider course not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/provider-courses/:id
router.get("/:id", async (req, res) => {
  try {
    await connectDB()
    const entry = await populate(ProviderCourse.findById(req.params.id))
    if (!entry) return res.status(404).json({ error: "Provider course not found" })
    res.json(entry)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch provider course", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/provider-courses/{id}:
 *   put:
 *     tags: [Admin - Provider Courses]
 *     summary: Update a provider-course mapping
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
 *             allOf:
 *               - $ref: '#/components/schemas/ProviderCourse'
 *               - type: object
 *                 properties:
 *                   degreeTypeId: { type: string }
 *                   title: { type: string }
 *     responses:
 *       200:
 *         description: Updated provider course (populated)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProviderCourse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Provider course not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// PUT /api/admin/provider-courses/:id
router.put("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const updated = await populate(
      ProviderCourse.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    )
    if (!updated) return res.status(404).json({ error: "Provider course not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "update", section: "provider-courses",
      itemId: req.params.id, itemName: updated.title || "Provider Course",
      details: `Updated provider course`,
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: "Failed to update provider course", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/provider-courses/{id}:
 *   delete:
 *     tags: [Admin - Provider Courses]
 *     summary: Delete a provider-course mapping
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Mapping deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Provider course not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/provider-courses/:id
router.delete("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const deleted = await ProviderCourse.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: "Provider course not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "delete", section: "provider-courses",
      itemId: req.params.id, itemName: deleted.title || "Provider Course",
      details: `Deleted provider course`,
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete provider course", details: err.message })
  }
})

export default router
