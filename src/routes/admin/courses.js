import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Course from "../../models/Course.js"
import { logActivity } from "../../lib/activityLogger.js"
import { getClerkUserInfo } from "../../lib/clerkHelper.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

/**
 * @openapi
 * /api/admin/courses:
 *   get:
 *     tags: [Admin - Courses]
 *     summary: List all courses
 *     description: Returns courses with populated `degreeTypeId` and `universities` (name only).
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Array of courses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Course' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/courses
router.get("/", async (req, res) => {
  try {
    const courses = await Course.find()
      .populate("degreeTypeId")
      .populate("universities", "name")
    res.json(courses)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch courses", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/courses:
 *   post:
 *     tags: [Admin - Courses]
 *     summary: Create a course
 *     description: Creates a course using whatever fields are accepted by the `Course` Mongoose schema (name, slug, description, degreeTypeId, universities, etc.).
 *     security:
 *       - clerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/Course'
 *               - type: object
 *                 properties:
 *                   degreeTypeId: { type: string }
 *                   universities:
 *                     type: array
 *                     items: { type: string, description: Provider ObjectId }
 *     responses:
 *       201:
 *         description: Course created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Course' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error (incl. validation), content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/courses
router.post("/", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)
    const body = req.body

    const course = await Course.create(body)

    await logActivity({
      userId, userName, userEmail,
      action: "create", section: "courses",
      itemId: course._id, itemName: course.name,
      details: `Created new course: ${course.name}`,
    })

    res.status(201).json(course)
  } catch (err) {
    res.status(500).json({ error: "Failed to create course", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/courses/{id}:
 *   get:
 *     tags: [Admin - Courses]
 *     summary: Get a course by ID
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Course Mongo ObjectId
 *     responses:
 *       200:
 *         description: Course document (with populated degreeType and universities)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Course' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Course not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/courses/:id
router.get("/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("degreeTypeId")
      .populate("universities", "name")
    if (!course) return res.status(404).json({ error: "Course not found" })
    res.json(course)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch course", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/courses/{id}:
 *   put:
 *     tags: [Admin - Courses]
 *     summary: Update a course
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
 *               - $ref: '#/components/schemas/Course'
 *               - type: object
 *                 properties:
 *                   degreeTypeId: { type: string }
 *                   universities:
 *                     type: array
 *                     items: { type: string }
 *     responses:
 *       200:
 *         description: Updated course (populated)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Course' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Course not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// PUT /api/admin/courses/:id
router.put("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const updated = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate("degreeTypeId")
      .populate("universities", "name")

    if (!updated) return res.status(404).json({ error: "Course not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "update", section: "courses",
      itemId: req.params.id, itemName: updated.name,
      details: `Updated course: ${JSON.stringify(req.body)}`,
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: "Failed to update course", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/courses/{id}:
 *   delete:
 *     tags: [Admin - Courses]
 *     summary: Delete a course
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Course not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/courses/:id
router.delete("/:id", async (req, res) => {
  try {
    await connectDB()
    const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

    const deleted = await Course.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: "Course not found" })

    await logActivity({
      userId, userName, userEmail,
      action: "delete", section: "courses",
      itemId: req.params.id, itemName: deleted.name,
      details: `Deleted course`,
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete course", details: err.message })
  }
})

export default router
