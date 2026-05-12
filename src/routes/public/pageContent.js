import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Page from "../../models/Page.js"
import PageContent from "../../models/PageContent.js"

const router = Router()

// GET /api/public/page-content/:slug — all content for a published page
/**
 * @openapi
 * /api/public/page-content/{slug}:
 *   get:
 *     tags: [Public - Pages]
 *     summary: Get a published page and all its section content items
 *     description: |
 *       Fetches a single published Page by slug along with all its PageContent rows
 *       (sorted by `sectionApiId` then `itemIndex`). Legacy items lacking `sectionApiId`
 *       have it back-filled from `page.sections[item.sectionIndex].apiIdentifier`.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Page and content items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: object
 *                   description: Published Page document
 *                 content:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: PageContent row
 *       404:
 *         description: Page not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/:slug", async (req, res) => {
  try {
    await connectDB()

    const page = await Page.findOne({ slug: req.params.slug, isPublished: true }).lean()
    if (!page) return res.status(404).json({ error: "Page not found" })

    const rawItems = await PageContent.find({ pageSlug: req.params.slug })
      .sort({ sectionApiId: 1, itemIndex: 1 })

    // Backfill sectionApiId for legacy records
    const contentItems = rawItems.map((item) => {
      if (!item.sectionApiId && typeof item.sectionIndex === "number") {
        const sec = page.sections[item.sectionIndex]
        if (sec?.apiIdentifier) {
          item = item.toObject()
          item.sectionApiId = sec.apiIdentifier
        }
      }
      return item
    })

    res.json({ page, content: contentItems })
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch page content", details: err.message })
  }
})

export default router
