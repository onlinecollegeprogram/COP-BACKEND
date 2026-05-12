import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Course from "../../models/Course.js"
import ProviderCourse from "../../models/ProviderCourse.js"

const router = Router()

// GET /api/public/courses/home-summary — courses grouped by degree type with aggregated stats
/**
 * @openapi
 * /api/public/courses/home-summary:
 *   get:
 *     tags: [Public - Courses]
 *     summary: Home-page summary of courses grouped by degree type
 *     description: |
 *       Returns active courses grouped by degree type, with aggregated provider-course stats
 *       (min fees, provider count, trending flag, etc.). Groups are sorted by `degreeType.order`.
 *     responses:
 *       200:
 *         description: Grouped courses summary
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
 *                         name: { type: string }
 *                         slug: { type: string }
 *                         icon: { type: string, nullable: true }
 *                         thumbnail: { type: string, nullable: true }
 *                         description: { type: string }
 *                         shortDescription: { type: string }
 *                         duration: { type: string }
 *                         feeStarting: { type: number }
 *                         minFees: { type: number }
 *                         providerCount: { type: integer }
 *                         universities:
 *                           type: array
 *                           items: { type: object }
 *                         isTrending: { type: boolean }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/", async (req, res) => {
  try {
    await connectDB()

    const courses = await Course.find({ isActive: true })
      .populate("degreeTypeId")
      .lean()

    const courseIds = courses.map((c) => c._id)

    // Aggregate per-course stats from ProviderCourse
    const providerStats = await ProviderCourse.aggregate([
      { $match: { courseId: { $in: courseIds }, isActive: true } },
      {
        $group: {
          _id: "$courseId",
          minFees: { $min: "$fees" },
          providerCount: { $sum: 1 },
          isTrending: { $max: { $cond: ["$trending", 1, 0] } },
          duration: { $first: "$duration" },
          thumbnail: { $first: "$thumbnail" },
          shortDescription: { $first: "$shortDescription" },
        },
      },
    ])

    const statsMap = {}
    providerStats.forEach((s) => {
      statsMap[s._id.toString()] = s
    })

    // Group courses by degree type
    const grouped = {}
    courses.forEach((course) => {
      const degreeType = course.degreeTypeId
      if (!degreeType) return

      const key = degreeType.slug
      if (!grouped[key]) {
        grouped[key] = {
          degreeType: { name: degreeType.name, slug: degreeType.slug, order: degreeType.order ?? 0 },
          courses: [],
        }
      }

      const stats = statsMap[course._id.toString()] || {}
      grouped[key].courses.push({
        _id: course._id,
        name: course.name,
        slug: course.slug,
        icon: course.icon || null,
        thumbnail: (course.icon && (course.icon.startsWith("/") || course.icon.startsWith("http"))) 
          ? course.icon 
          : (stats.thumbnail || null),
        description: course.description || "",
        shortDescription: course.shortDescription || course.description || stats.shortDescription || "",
        duration: course.duration || stats.duration || "",
        feeStarting: course.feeStarting || stats.minFees || 0,
        minFees: course.feeStarting || stats.minFees || 0,
        providerCount: (Array.isArray(course.universities) && course.universities.length > 0) 
          ? course.universities.length 
          : (stats.providerCount || 0),
        universities: course.universities || [],
        isTrending: course.isTrending || stats.isTrending === 1,
      })
    })

    // Return sorted by degreeType order
    const result = Object.values(grouped).sort(
      (a, b) => (a.degreeType.order ?? 0) - (b.degreeType.order ?? 0)
    )
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch courses summary", details: err.message })
  }
})

export default router
