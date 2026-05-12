import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Blog from "../../models/Blog.js"
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
  const query = excludeId ? { slug, _id: { $ne: excludeId } } : { slug }
  while (await Blog.findOne(query)) {
    i++
    slug = `${base}-${i}`
    query.slug = slug
  }
  return slug
}

/**
 * @openapi
 * /api/admin/blogs:
 *   get:
 *     tags: [Admin - Blogs]
 *     summary: List all blogs
 *     description: Returns every blog document, newest first.
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Array of blog documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   title: { type: string }
 *                   slug: { type: string }
 *                   content: { type: string }
 *                   coverImage: { type: string }
 *                   createdAt: { type: string, format: date-time }
 *                   updatedAt: { type: string, format: date-time }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/blogs
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const blogs = await Blog.find().sort({ createdAt: -1 })
    res.json(blogs)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blogs", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/blogs:
 *   post:
 *     tags: [Admin - Blogs]
 *     summary: Create a blog
 *     description: |
 *       Creates a new blog. If `slug` is omitted, one is generated from `title`. The slug is
 *       made unique by appending `-1`, `-2`, ... if a collision is detected.
 *     security:
 *       - clerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               slug: { type: string, description: Optional; generated from title if omitted }
 *               content: { type: string }
 *               coverImage: { type: string }
 *     responses:
 *       201:
 *         description: Blog created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 title: { type: string }
 *                 slug: { type: string }
 *       400:
 *         description: Title missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/blogs
router.post("/", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)
    const body = req.body

    if (!body.title) {
      return res.status(400).json({ error: "Title is required" })
    }

    const base = slugify(body.slug || body.title)
    const slug = await uniqueSlug(base)

    const blog = await Blog.create({ ...body, slug })

    await logActivity({
      userId, userName, userEmail,
      action: "create", section: "blogs",
      itemId: blog._id, itemName: blog.title,
      details: `Created new blog: ${blog.title}`,
    })

    res.status(201).json(blog)
  } catch (err) {
    res.status(500).json({ error: "Failed to create blog", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/blogs/{slug}:
 *   get:
 *     tags: [Admin - Blogs]
 *     summary: Get a blog by slug
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Blog document
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 title: { type: string }
 *                 slug: { type: string }
 *                 content: { type: string }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Blog not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/blogs/:slug
router.get("/:slug", async (req, res) => {
  try {
    await connectDB()
    const blog = await Blog.findOne({ slug: req.params.slug })
    if (!blog) return res.status(404).json({ error: "Blog not found" })
    res.json(blog)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blog", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/blogs/{slug}:
 *   put:
 *     tags: [Admin - Blogs]
 *     summary: Update a blog
 *     description: Updates a blog by its current slug. If `title` or `slug` is in the body, a new unique slug is computed.
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               slug: { type: string }
 *               content: { type: string }
 *               coverImage: { type: string }
 *     responses:
 *       200:
 *         description: Updated blog
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 title: { type: string }
 *                 slug: { type: string }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Blog not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// PUT /api/admin/blogs/:slug
router.put("/:slug", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)
    const body = req.body

    if (body.title || body.slug) {
      const base = slugify(body.slug || body.title)
      const existing = await Blog.findOne({ slug: req.params.slug })
      body.slug = await uniqueSlug(base, existing?._id)
    }

    const blog = await Blog.findOneAndUpdate(
      { slug: req.params.slug },
      body,
      { new: true, runValidators: true }
    )

    if (!blog) return res.status(404).json({ error: "Blog not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "update", section: "blogs",
      itemId: blog._id, itemName: blog.title,
      details: `Updated blog: ${blog.title}`,
    })

    res.json(blog)
  } catch (err) {
    res.status(500).json({ error: "Failed to update blog", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/blogs/{slug}:
 *   delete:
 *     tags: [Admin - Blogs]
 *     summary: Delete a blog
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Blog deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Blog not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/blogs/:slug
router.delete("/:slug", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const blog = await Blog.findOneAndDelete({ slug: req.params.slug })
    if (!blog) return res.status(404).json({ error: "Blog not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "delete", section: "blogs",
      itemId: blog._id, itemName: blog.title,
      details: `Deleted blog: ${blog.title}`,
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete blog", details: err.message })
  }
})

export default router
