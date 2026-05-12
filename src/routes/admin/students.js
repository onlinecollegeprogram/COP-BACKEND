import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Student from "../../models/Student.js"
import { logActivity } from "../../lib/activityLogger.js"
import { getClerkUserInfo } from "../../lib/clerkHelper.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

/**
 * @openapi
 * /api/admin/students:
 *   get:
 *     tags: [Admin - Students]
 *     summary: List all students
 *     description: Returns students newest-first, excluding sensitive fields (`password`, reset tokens).
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Array of students
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Student' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/students
router.get("/", async (req, res) => {
    try {
        await connectDB()
        const students = await Student.find()
            .select("-password -resetPasswordToken -resetPasswordExpires")
            .sort({ createdAt: -1 })
        res.json(students)
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch students", details: err.message })
    }
})

/**
 * @openapi
 * /api/admin/students/{id}:
 *   get:
 *     tags: [Admin - Students]
 *     summary: Get a student by ID
 *     description: Returns the student with sensitive fields (`password`, reset tokens) stripped.
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Student document
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Student' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Student not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/students/:id
router.get("/:id", async (req, res) => {
    try {
        await connectDB()
        const student = await Student.findById(req.params.id).select(
            "-password -resetPasswordToken -resetPasswordExpires"
        )
        if (!student) return res.status(404).json({ error: "Student not found" })
        res.json(student)
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch student", details: err.message })
    }
})

/**
 * @openapi
 * /api/admin/students/{id}:
 *   patch:
 *     tags: [Admin - Students]
 *     summary: Update an admin-editable student field
 *     description: Currently only `isActive` is honored (used to suspend/reactivate a student).
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
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated student (sensitive fields stripped)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Student' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Student not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// PATCH /api/admin/students/:id — toggle active / update basic admin-editable fields
router.patch("/:id", async (req, res) => {
    try {
        await connectDB()
        const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

        const student = await Student.findById(req.params.id)
        if (!student) return res.status(404).json({ error: "Student not found" })

        if (req.body.isActive !== undefined) student.isActive = req.body.isActive

        await student.save()

        await logActivity({
            userId,
            userName,
            userEmail,
            action: "update",
            section: "students",
            itemId: student._id,
            itemName: student.name || student.email || student.phone || "Student",
            details: `Updated student (isActive=${student.isActive})`,
        })

        const safe = student.toObject()
        delete safe.password
        delete safe.resetPasswordToken
        delete safe.resetPasswordExpires
        res.json(safe)
    } catch (err) {
        res.status(500).json({ error: "Failed to update student", details: err.message })
    }
})

/**
 * @openapi
 * /api/admin/students/{id}:
 *   delete:
 *     tags: [Admin - Students]
 *     summary: Delete a student account
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Student deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Student not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/students/:id
router.delete("/:id", async (req, res) => {
    try {
        await connectDB()
        const { userId, userName, userEmail } = await getClerkUserInfo(req.clerkUserId)

        const deleted = await Student.findByIdAndDelete(req.params.id)
        if (!deleted) return res.status(404).json({ error: "Student not found" })

        await logActivity({
            userId,
            userName,
            userEmail,
            action: "delete",
            section: "students",
            itemId: req.params.id,
            itemName: deleted.name || deleted.email || deleted.phone || "Student",
            details: `Deleted student account`,
        })

        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: "Failed to delete student", details: err.message })
    }
})

export default router
