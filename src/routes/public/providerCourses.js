import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import ProviderCourse from "../../models/ProviderCourse.js"

const router = Router()

const populate = (query) =>
  query.populate("providerId").populate("degreeTypeId").populate("courseId").populate("specializationId")

// GET /api/public/provider-courses/home-summary — provider courses grouped by degree type
/**
 * @openapi
 * /api/public/provider-courses/home-summary:
 *   get:
 *     tags: [Public - Provider Courses]
 *     summary: Home-page summary of provider courses grouped by degree type
 *     description: |
 *       Returns active ProviderCourses grouped by their degree type, with each entry mapped
 *       to a frontend "CourseItem" shape (title, slug, thumbnail, min fees, provider name, etc.).
 *       Groups are sorted by `degreeType.order`.
 *     responses:
 *       200:
 *         description: Grouped provider courses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   degreeType:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       slug: { type: string }
 *                       order: { type: integer }
 *                   courses:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         _id: { type: string }
 *                         courseId: { type: string, nullable: true }
 *                         name: { type: string }
 *                         slug: { type: string }
 *                         thumbnail: { type: string, nullable: true }
 *                         shortDescription: { type: string }
 *                         duration: { type: string }
 *                         minFees: { type: number }
 *                         providerCount: { type: integer }
 *                         providerName: { type: string }
 *                         isTrending: { type: boolean }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/home-summary", async (req, res) => {
  try {
    await connectDB()
    const entries = await populate(ProviderCourse.find({ isActive: true }))
    
    const grouped = {}
    entries.forEach((pc) => {
      const dt = pc.degreeTypeId
      if (!dt) return

      const key = dt.slug
      if (!grouped[key]) {
        grouped[key] = {
          degreeType: { name: dt.name, slug: dt.slug, order: dt.order ?? 0 },
          courses: [],
        }
      }

      // Map ProviderCourse to CourseItem structure expected by frontend
      grouped[key].courses.push({
        _id: pc._id,
        courseId: pc.courseId?._id, // Keep original course ID for detail link
        name: pc.title || (pc.courseId ? pc.courseId.name : "Unknown"),
        slug: pc.slug,
        thumbnail: pc.thumbnail || null,
        shortDescription: pc.shortDescription || "",
        duration: pc.duration || "",
        minFees: pc.minFees || pc.fees || 0,
        providerCount: 0,
        providerName: pc.providerId?.name || "", // Add provider name
        isTrending: pc.trending || false,
      })
    })

    const result = Object.values(grouped).sort(
      (a, b) => (a.degreeType.order ?? 0) - (b.degreeType.order ?? 0)
    )
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch provider courses summary", details: err.message })
  }
})

// GET /api/public/provider-courses/count
/**
 * @openapi
 * /api/public/provider-courses/count:
 *   get:
 *     tags: [Public - Provider Courses]
 *     summary: Get the total count of active provider courses
 *     responses:
 *       200:
 *         description: Active provider course count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count: { type: integer }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/count", async (req, res) => {
  try {
    await connectDB()
    const count = await ProviderCourse.countDocuments({ isActive: true })
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch provider courses count", details: err.message })
  }
})

// GET /api/public/provider-courses
/**
 * @openapi
 * /api/public/provider-courses:
 *   get:
 *     tags: [Public - Provider Courses]
 *     summary: List active provider courses
 *     description: Returns active ProviderCourses with provider, degree type, course, and specialization populated. Optionally filterable by specialization.
 *     parameters:
 *       - in: query
 *         name: specializationId
 *         required: false
 *         schema: { type: string }
 *         description: Filter results to a single specialization id.
 *     responses:
 *       200:
 *         description: Array of provider courses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ProviderCourse' }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const query = { isActive: true }
    
    // Allow filtering by specializationId
    if (req.query.specializationId) {
      query.specializationId = req.query.specializationId
    }
    
    const entries = await populate(ProviderCourse.find(query))
    res.json(entries)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch provider courses", details: err.message })
  }
})

export default router
