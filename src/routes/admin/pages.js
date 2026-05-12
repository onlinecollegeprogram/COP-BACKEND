import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Page from "../../models/Page.js"
import PageContent from "../../models/PageContent.js"
import { logActivity } from "../../lib/activityLogger.js"
import { getClerkUserInfo } from "../../lib/clerkHelper.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

// ── Pages ─────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/admin/pages:
 *   get:
 *     tags: [Admin - Pages]
 *     summary: List all page schemas
 *     description: Returns every page document (schema definitions), newest first.
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Array of page documents
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
 *                   description: { type: string }
 *                   sections: { type: array, items: { type: object } }
 *                   isPublished: { type: boolean }
 *                   createdAt: { type: string, format: date-time }
 *                   updatedAt: { type: string, format: date-time }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/pages
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const pages = await Page.find().sort({ createdAt: -1 })
    res.json(pages)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pages", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/pages:
 *   post:
 *     tags: [Admin - Pages]
 *     summary: Create a new page schema
 *     description: Pages are created with an empty `sections` array and `isPublished=false`. Slug must be unique.
 *     security:
 *       - clerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, slug]
 *             properties:
 *               title: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Page created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 title: { type: string }
 *                 slug: { type: string }
 *                 isPublished: { type: boolean }
 *       400:
 *         description: Missing title/slug or slug already exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/pages
router.post("/", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)
    const body = req.body

    if (!body.title || !body.slug) {
      return res.status(400).json({ error: "Title and slug are required" })
    }

    const existing = await Page.findOne({ slug: body.slug })
    if (existing) return res.status(400).json({ error: "Slug already exists" })

    const page = await Page.create({
      title: body.title,
      slug: body.slug,
      description: body.description || "",
      sections: [],
      isPublished: false,
    })

    await logActivity({
      userId, userName, userEmail,
      action: "create", section: "pages",
      itemId: page._id, itemName: page.title,
      details: `Created new page: ${page.title}`,
    })

    res.status(201).json(page)
  } catch (err) {
    res.status(500).json({ error: "Failed to create page", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/pages/{slug}:
 *   get:
 *     tags: [Admin - Pages]
 *     summary: Get a page schema by slug
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Page document
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 title: { type: string }
 *                 slug: { type: string }
 *                 sections: { type: array, items: { type: object } }
 *                 isPublished: { type: boolean }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Page not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/pages/:slug
router.get("/:slug", async (req, res) => {
  try {
    await connectDB()
    const page = await Page.findOne({ slug: req.params.slug })
    if (!page) return res.status(404).json({ error: "Page not found" })
    res.json(page)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch page", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/pages/{slug}:
 *   put:
 *     tags: [Admin - Pages]
 *     summary: Update a page schema
 *     description: |
 *       Updates page metadata and its `sections` array. If sections are removed, their associated
 *       `PageContent` records are deleted. If sections are reordered, the `sectionIndex` of every
 *       related `PageContent` record is updated to match the new order.
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
 *               description: { type: string }
 *               isPublished: { type: boolean }
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     apiIdentifier: { type: string }
 *                     sectionIndex: { type: integer }
 *     responses:
 *       200:
 *         description: Updated page
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 title: { type: string }
 *                 slug: { type: string }
 *                 sections: { type: array, items: { type: object } }
 *       400:
 *         description: Validation failed (returns `fieldErrors` array)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 fieldErrors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       path: { type: string }
 *                       message: { type: string }
 *                 details: { type: string }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Page not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// PUT /api/admin/pages/:slug
router.put("/:slug", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)
    const body = req.body

    // Get current page to check for removed/reordered sections
    const currentPage = await Page.findOne({ slug: req.params.slug })
    if (!currentPage) return res.status(404).json({ error: "Page not found" })

    const currentSectionApiIds = currentPage.sections.map(s => s.apiIdentifier)
    const newSectionApiIds = body.sections.map(s => s.apiIdentifier)
    const removedSectionApiIds = currentSectionApiIds.filter(id => !newSectionApiIds.includes(id))

    // Delete content for removed sections
    if (removedSectionApiIds.length > 0) {
      await PageContent.deleteMany({
        pageSlug: req.params.slug,
        sectionApiId: { $in: removedSectionApiIds }
      })
    }

    // Handle section reordering: update sectionIndex in PageContent for all sections
    // Create a map of apiId -> new sectionIndex
    const sectionIndexMap = {}
    body.sections.forEach((section, idx) => {
      sectionIndexMap[section.apiIdentifier] = idx
    })

    // Update all PageContent records with new sectionIndex
    for (const [apiId, newIndex] of Object.entries(sectionIndexMap)) {
      await PageContent.updateMany(
        { pageSlug: req.params.slug, sectionApiId: apiId },
        { $set: { sectionIndex: newIndex } }
      )
    }

    const page = await Page.findOneAndUpdate(
      { slug: req.params.slug },
      {
        title: body.title,
        description: body.description,
        sections: body.sections,
        isPublished: body.isPublished,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    )

    await logActivity({
      userId, userName, userEmail,
      action: "update", section: "pages",
      itemId: page._id, itemName: page.title,
      details: `Updated page: ${page.title}`,
    })

    res.json(page)
  } catch (err) {
    if (err?.name === "ValidationError") {
      const fieldErrors = Object.entries(err.errors || {}).map(([path, e]) => ({
        path,
        message: e.message,
      }))
      return res.status(400).json({
        error: "Validation failed — please fill in all required fields",
        fieldErrors,
        details: err.message,
      })
    }
    console.error("PUT /pages/:slug error:", err)
    res.status(500).json({ error: "Failed to update page", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/pages/{slug}:
 *   delete:
 *     tags: [Admin - Pages]
 *     summary: Delete a page and all of its content
 *     description: Deletes the page document and every `PageContent` record matched by `pageSlug`.
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Page and content deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Page not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/pages/:slug
router.delete("/:slug", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const page = await Page.findOne({ slug: req.params.slug })
    if (!page) return res.status(404).json({ error: "Page not found" })

    // Delete associated page content
    await PageContent.deleteMany({ pageSlug: req.params.slug })

    await Page.findOneAndDelete({ slug: req.params.slug })

    await logActivity({
      userId, userName, userEmail,
      action: "delete", section: "pages",
      itemId: page._id, itemName: page.title,
      details: `Deleted page: ${page.title} and its content`,
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete page", details: err.message })
  }
})

// ── Page Content ──────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/admin/pages/{slug}/content:
 *   get:
 *     tags: [Admin - Pages]
 *     summary: Get all content items for a page
 *     description: Returns every `PageContent` row for the page, sorted by `sectionIndex` then `itemIndex`. Backfills `sectionIndex` for legacy records.
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of page content items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   pageSlug: { type: string }
 *                   sectionApiId: { type: string }
 *                   sectionIndex: { type: integer }
 *                   itemIndex: { type: integer }
 *                   values: { type: object, description: Section-defined values map }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/pages/:slug/content
router.get("/:slug/content", async (req, res) => {
  try {
    await connectDB()
    const { slug } = req.params

    const page = await Page.findOne({ slug }).lean()
    const rawItems = await PageContent.find({ pageSlug: slug }).sort({
      sectionIndex: 1,
      itemIndex: 1,
    })

    // Backfill sectionIndex/sectionApiId for old records
    const contentItems = rawItems.map((item) => {
      if (!item.sectionIndex && typeof item.sectionIndex === "undefined" && page) {
        const sec = page.sections.find(s => s.apiIdentifier === item.sectionApiId)
        if (sec) {
          item = item.toObject ? item.toObject() : { ...item }
          item.sectionIndex = sec.sectionIndex
        }
      }
      return item
    })

    res.json(contentItems)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch page content", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/pages/{slug}/content:
 *   post:
 *     tags: [Admin - Pages]
 *     summary: Create or update a content item for a page section
 *     description: |
 *       Upserts a `PageContent` row keyed by (`pageSlug`, `sectionApiId`, `itemIndex`).
 *       Provide either `sectionApiId` or `sectionIndex` — the other is resolved from the page schema.
 *       `originalItemIndex` lets the client reorder items within a section.
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
 *               sectionApiId: { type: string }
 *               sectionIndex: { type: integer }
 *               itemIndex: { type: integer, default: 0 }
 *               originalItemIndex: { type: integer, description: Previous itemIndex when reordering }
 *               values: { type: object, description: Section-defined values map }
 *     responses:
 *       201:
 *         description: Content created or updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 pageSlug: { type: string }
 *                 sectionApiId: { type: string }
 *                 sectionIndex: { type: integer }
 *                 itemIndex: { type: integer }
 *                 values: { type: object }
 *       400:
 *         description: Missing sectionApiId/sectionIndex
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Page not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/pages/:slug/content
router.post("/:slug/content", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)
    const { slug } = req.params
    let { sectionApiId, sectionIndex, itemIndex = 0, values, originalItemIndex } = req.body

    const page = await Page.findOne({ slug })
    if (!page) return res.status(404).json({ error: "Page not found" })

    // Resolve sectionApiId and sectionIndex from section data
    let resolvedSectionIndex = sectionIndex
    let resolvedSectionApiId = sectionApiId

    if (!resolvedSectionApiId && typeof sectionIndex === "number") {
      const sec = page.sections.find(s => s.sectionIndex === sectionIndex)
      if (sec?.apiIdentifier) {
        resolvedSectionApiId = sec.apiIdentifier
        resolvedSectionIndex = sectionIndex
      }
    }

    if (!resolvedSectionIndex && resolvedSectionApiId) {
      const sec = page.sections.find(s => s.apiIdentifier === resolvedSectionApiId)
      if (sec?.sectionIndex !== undefined) {
        resolvedSectionIndex = sec.sectionIndex
      }
    }

    if (!resolvedSectionApiId || resolvedSectionIndex === undefined) {
      return res.status(400).json({ error: "sectionApiId and sectionIndex are required" })
    }

    let content = null
    let action = "create"

    if (originalItemIndex !== undefined && originalItemIndex !== itemIndex) {
      content = await PageContent.findOne({ pageSlug: slug, sectionApiId: resolvedSectionApiId, itemIndex: originalItemIndex })
    }
    if (!content) {
      content = await PageContent.findOne({ pageSlug: slug, sectionApiId: resolvedSectionApiId, itemIndex })
    }

    if (content) {
      content.values = values
      if (originalItemIndex !== undefined && originalItemIndex !== itemIndex) {
        content.itemIndex = itemIndex
      }
      action = "update"
    } else {
      content = new PageContent({
        pageSlug: slug,
        sectionApiId: resolvedSectionApiId,
        sectionIndex: resolvedSectionIndex,
        itemIndex,
        values
      })
    }

    await content.save()

    await logActivity({
      userId, userName, userEmail,
      action, section: "page-content",
      itemName: page.title,
      details: `${action}d content for page "${page.title}" section ${resolvedSectionApiId} (index ${resolvedSectionIndex})`,
    })

    res.status(201).json(content)
  } catch (err) {
    res.status(500).json({ error: "Failed to save page content", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/pages/{slug}/content:
 *   delete:
 *     tags: [Admin - Pages]
 *     summary: Delete a single content item from a page section
 *     description: Removes one `PageContent` row identified by (`pageSlug`, `sectionApiId`, `itemIndex`). Provide either `sectionApiId` or `sectionIndex`.
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
 *               sectionApiId: { type: string }
 *               sectionIndex: { type: integer }
 *               itemIndex: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Content item deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400:
 *         description: sectionApiId/sectionIndex missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Page or content not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/pages/:slug/content
router.delete("/:slug/content", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)
    const { slug } = req.params
    let { sectionApiId, sectionIndex, itemIndex = 0 } = req.body

    const page = await Page.findOne({ slug })
    if (!page) return res.status(404).json({ error: "Page not found" })

    // Resolve sectionApiId from sectionIndex if needed
    if (!sectionApiId && typeof sectionIndex === "number") {
      const sec = page.sections.find(s => s.sectionIndex === sectionIndex)
      if (sec?.apiIdentifier) sectionApiId = sec.apiIdentifier
    }

    if (!sectionApiId) {
      return res.status(400).json({ error: "sectionApiId or sectionIndex is required" })
    }

    const result = await PageContent.deleteOne({ pageSlug: slug, sectionApiId, itemIndex })
    if (result.deletedCount === 0) return res.status(404).json({ error: "Content not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "delete", section: "page-content",
      itemName: page.title,
      details: `Deleted content for page "${page.title}" section ${sectionApiId} (item ${itemIndex})`,
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete page content", details: err.message })
  }
})

export default router
