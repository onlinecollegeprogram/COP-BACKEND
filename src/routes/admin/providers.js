import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Provider from "../../models/Provider.js"
import { logActivity } from "../../lib/activityLogger.js"
import { getClerkUserInfo } from "../../lib/clerkHelper.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

const slugify = (str = "") =>
  str.toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]+/g, "")

async function uniqueSlug(base, excludeId = null) {
  if (!base) base = Date.now().toString()
  let slug = base
  let i = 0
  while (await Provider.findOne({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    i++
    slug = `${base}-${i}`
  }
  return slug
}

/**
 * @openapi
 * /api/admin/providers:
 *   get:
 *     tags: [Admin - Providers]
 *     summary: List all providers
 *     description: Returns every provider (university) sorted newest-first.
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Array of providers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Provider' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/providers
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const providers = await Provider.find().sort({ createdAt: -1 })
    res.json(providers)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch providers", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/providers:
 *   post:
 *     tags: [Admin - Providers]
 *     summary: Create a provider
 *     description: Slug is auto-generated from `name` (or `slug` if supplied) and made unique by suffixing `-N` on collision.
 *     security:
 *       - clerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/Provider'
 *               - type: object
 *                 properties:
 *                   metaTitle: { type: string }
 *                   metaDescription: { type: string }
 *     responses:
 *       201:
 *         description: Provider created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Provider' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/providers
router.post("/", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)
    const body = req.body

    const base = slugify(body.name || body.slug || "")
    const slug = await uniqueSlug(base)
    const provider = await Provider.create({ ...body, slug })

    await logActivity({
      userId, userName, userEmail,
      action: "create", section: "providers",
      itemId: provider._id, itemName: provider.name,
      details: `Created new provider: ${provider.name}`,
    })

    res.status(201).json(provider)
  } catch (err) {
    res.status(500).json({ error: "Failed to create provider", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/providers/{id}:
 *   get:
 *     tags: [Admin - Providers]
 *     summary: Get a provider by ID
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Provider document
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Provider' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Provider not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/providers/:id
router.get("/:id", async (req, res) => {
  try {
    await connectDB()
    const provider = await Provider.findById(req.params.id)
    if (!provider) return res.status(404).json({ error: "Provider not found" })
    res.json(provider)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch provider", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/providers/{id}:
 *   put:
 *     tags: [Admin - Providers]
 *     summary: Update a provider
 *     description: When `name` or `slug` is in the body, a new unique slug is recomputed (excluding the current document from the uniqueness check).
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
 *           schema: { $ref: '#/components/schemas/Provider' }
 *     responses:
 *       200:
 *         description: Updated provider
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Provider' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Provider not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// PUT /api/admin/providers/:id
router.put("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)
    const body = req.body

    if (body.name || body.slug) {
      const base = slugify(body.name || body.slug || "")
      body.slug = await uniqueSlug(base, req.params.id)
    }

    const updated = await Provider.findByIdAndUpdate(req.params.id, body, { new: true })
    if (!updated) return res.status(404).json({ error: "Provider not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "update", section: "providers",
      itemId: req.params.id, itemName: updated.name,
      details: `Updated provider: ${updated.name}`,
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: "Failed to update provider", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/providers/{id}:
 *   delete:
 *     tags: [Admin - Providers]
 *     summary: Delete a provider
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Provider deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Provider not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/providers/:id
router.delete("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const deleted = await Provider.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: "Provider not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "delete", section: "providers",
      itemId: req.params.id, itemName: deleted.name,
      details: `Deleted provider`,
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete provider", details: err.message })
  }
})

export default router
