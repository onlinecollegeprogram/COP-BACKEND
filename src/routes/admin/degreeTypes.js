import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import DegreeType from "../../models/DegreeType.js"
import { logActivity } from "../../lib/activityLogger.js"
import { getClerkUserInfo } from "../../lib/clerkHelper.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

/**
 * @openapi
 * /api/admin/degree-types:
 *   get:
 *     tags: [Admin - Degree Types]
 *     summary: List degree types
 *     description: Returns all degree types sorted by `order` ascending.
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Array of degree types
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   name: { type: string }
 *                   slug: { type: string }
 *                   order: { type: integer }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/degree-types
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const degrees = await DegreeType.find().sort({ order: 1 })
    res.json(degrees)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch degree types", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/degree-types:
 *   post:
 *     tags: [Admin - Degree Types]
 *     summary: Create a degree type
 *     description: Slug is auto-generated from `name` (lowercased, spaces replaced with `-`).
 *     security:
 *       - clerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               order: { type: integer }
 *     responses:
 *       201:
 *         description: Degree type created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 name: { type: string }
 *                 slug: { type: string }
 *                 order: { type: integer }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/degree-types
router.post("/", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)
    const body = req.body

    const slug = body.name.toLowerCase().replace(/\s+/g, "-")
    const degree = await DegreeType.create({ ...body, slug })

    await logActivity({
      userId, userName, userEmail,
      action: "create", section: "degree-types",
      itemId: degree._id, itemName: degree.name,
      details: `Created new degree type: ${degree.name}`,
    })

    res.status(201).json(degree)
  } catch (err) {
    res.status(500).json({ error: "Failed to create degree type", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/degree-types/{id}:
 *   get:
 *     tags: [Admin - Degree Types]
 *     summary: Get a degree type by ID
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Degree type document
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 name: { type: string }
 *                 slug: { type: string }
 *                 order: { type: integer }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Degree type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/degree-types/:id
router.get("/:id", async (req, res) => {
  try {
    await connectDB()
    const degree = await DegreeType.findById(req.params.id)
    if (!degree) return res.status(404).json({ error: "Degree type not found" })
    res.json(degree)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch degree type", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/degree-types/{id}:
 *   put:
 *     tags: [Admin - Degree Types]
 *     summary: Update a degree type
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
 *               slug: { type: string }
 *               order: { type: integer }
 *     responses:
 *       200:
 *         description: Updated degree type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 name: { type: string }
 *                 slug: { type: string }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Degree type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// PUT /api/admin/degree-types/:id
router.put("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const updated = await DegreeType.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!updated) return res.status(404).json({ error: "Degree type not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "update", section: "degree-types",
      itemId: req.params.id, itemName: updated.name,
      details: `Updated degree type: ${JSON.stringify(req.body)}`,
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: "Failed to update degree type", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/degree-types/{id}:
 *   delete:
 *     tags: [Admin - Degree Types]
 *     summary: Delete a degree type
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Degree type deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Degree type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/degree-types/:id
router.delete("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const deleted = await DegreeType.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: "Degree type not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "delete", section: "degree-types",
      itemId: req.params.id, itemName: deleted.name,
      details: `Deleted degree type`,
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete degree type", details: err.message })
  }
})

export default router
