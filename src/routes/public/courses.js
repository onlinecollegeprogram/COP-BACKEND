import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Course from "../../models/Course.js"
import ProviderCourse from "../../models/ProviderCourse.js"

const router = Router()

// GET /api/public/courses — list all active courses
/**
 * @openapi
 * /api/public/courses:
 *   get:
 *     tags: [Public - Courses]
 *     summary: List all active courses
 *     description: Returns every active course with its populated degree type. Public endpoint.
 *     responses:
 *       200:
 *         description: Array of active courses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Course' }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const courses = await Course.find({ isActive: true }).populate("degreeTypeId")
    res.json(courses)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch courses", details: err.message })
  }
})

// GET /api/public/courses/:identifier — single course with its provider programs.
// `identifier` may be a Course ObjectId/slug OR a ProviderCourse ObjectId/slug;
// in the latter case we resolve to the parent Course and flag the matched program.
/**
 * @openapi
 * /api/public/courses/{identifier}:
 *   get:
 *     tags: [Public - Courses]
 *     summary: Get a course (or program-matched course) with all its provider programs
 *     description: |
 *       The `identifier` may be either a Course ObjectId/slug OR a ProviderCourse ObjectId/slug.
 *       If a ProviderCourse identifier is given, the parent Course is resolved and the matched
 *       program is flagged via `selectedProgramId`.
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         description: Course ObjectId, course slug, ProviderCourse ObjectId, or ProviderCourse slug.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course with its programs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 course: { $ref: '#/components/schemas/Course' }
 *                 programs:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ProviderCourse' }
 *                 selectedProgramId:
 *                   type: string
 *                   nullable: true
 *       404:
 *         description: Course not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/:identifier", async (req, res) => {
  try {
    await connectDB()
    const identifier = req.params.identifier
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier)

    const courseQuery = isObjectId
      ? { _id: identifier, isActive: true }
      : { slug: identifier, isActive: true }

    let course = await Course.findOne(courseQuery).populate("degreeTypeId")
    let selectedProgramId = null

    if (!course) {
      const providerCourseQuery = isObjectId
        ? { _id: identifier, isActive: true }
        : { slug: identifier, isActive: true }
      const matchedProgram = await ProviderCourse.findOne(providerCourseQuery)
      if (matchedProgram?.courseId) {
        course = await Course.findOne({ _id: matchedProgram.courseId, isActive: true })
          .populate("degreeTypeId")
        if (course) selectedProgramId = matchedProgram._id
      }
    }

    if (!course) return res.status(404).json({ error: "Course not found" })

    const providerCourses = await ProviderCourse.find({ courseId: course._id, isActive: true })
      .populate("providerId")
      .populate("specializationId")
      .populate("degreeTypeId")
      .sort({ fees: 1 }) // Show cheapest first or trending

    res.json({
      course,
      programs: providerCourses,
      selectedProgramId,
    })
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch course detail", details: err.message })
  }
})

export default router
