import { Router } from "express"
import Student from "../../../models/Student.js"
import { connectDB } from "../../../lib/db.js"
import { requireStudentAuth } from "../../../middleware/studentAuth.js"

const router = Router()

// DELETE /api/public/student/account
// Body: { password } — required for confirmation
/**
 * @openapi
 * /api/public/student/account:
 *   delete:
 *     tags: [Student - Profile]
 *     summary: Permanently delete the logged-in student's account
 *     description: Requires the student's current password for confirmation.
 *     security:
 *       - studentAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Account deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: Password confirmation missing
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         description: Password incorrect or token missing
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       404:
 *         description: Student not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.delete("/", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const { password } = req.body || {}

        const student = await Student.findById(req.student._id)
        if (!student) return res.status(404).json({ error: "Student not found" })

        if (!password) {
            return res
                .status(400)
                .json({ error: "Password confirmation is required to delete account" })
        }

        const match = await student.matchPassword(password)
        if (!match) return res.status(401).json({ error: "Password is incorrect" })

        await Student.findByIdAndDelete(student._id)
        res.json({ message: "Account has been permanently deleted" })
    } catch (err) {
        console.error("Delete account error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

export default router
