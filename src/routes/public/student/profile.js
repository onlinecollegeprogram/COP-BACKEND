import { Router } from "express"
import Student from "../../../models/Student.js"
import { connectDB } from "../../../lib/db.js"
import { requireStudentAuth } from "../../../middleware/studentAuth.js"
import { sanitizeStudent } from "../../../lib/studentToken.js"

const router = Router()

// GET /api/public/student/profile
/**
 * @openapi
 * /api/public/student/profile:
 *   get:
 *     tags: [Student - Profile]
 *     summary: Get the logged-in student's profile
 *     description: Returns the student profile plus a `hasPassword` flag. Sensitive fields (`password`, reset tokens) are stripped.
 *     security:
 *       - studentAuth: []
 *     responses:
 *       200:
 *         description: Student profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Student'
 *                 - type: object
 *                   properties:
 *                     hasPassword: { type: boolean }
 *       401:
 *         description: Unauthorized
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       404:
 *         description: Student not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        // req.student excludes password (-password). Re-query with password
        // selected so we can expose a hasPassword flag without leaking the hash.
        const full = await Student.findById(req.student._id).select("+password")
        if (!full) return res.status(404).json({ error: "Student not found" })

        const obj = full.toObject()
        const hasPassword = !!obj.password
        delete obj.password
        delete obj.resetPasswordToken
        delete obj.resetPasswordExpires

        res.json({ ...obj, hasPassword })
    } catch (err) {
        console.error("Profile fetch error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

// PUT /api/public/student/profile
/**
 * @openapi
 * /api/public/student/profile:
 *   put:
 *     tags: [Student - Profile]
 *     summary: Update the logged-in student's profile
 *     description: |
 *       Updates a whitelisted set of fields. When `firstName` or `lastName` are supplied,
 *       the combined `name` is automatically kept in sync.
 *     security:
 *       - studentAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               courseOfInterest: { type: string }
 *               dateOfBirth: { type: string, format: date }
 *               city: { type: string }
 *               state: { type: string }
 *               country: { type: string }
 *               currentEducation: { type: string }
 *               occupation: { type: string }
 *               currentCompanyOrUniversity: { type: string }
 *               profilePhoto: { type: string }
 *     responses:
 *       200:
 *         description: Updated, sanitized student
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Student' }
 *       401:
 *         description: Unauthorized
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       404:
 *         description: Student not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.put("/", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const student = await Student.findById(req.student._id)
        if (!student) return res.status(404).json({ error: "Student not found" })

        const editable = [
            "name",
            "firstName",
            "lastName",
            "phone",
            "email",
            "courseOfInterest",
            "dateOfBirth",
            "city",
            "state",
            "country",
            "currentEducation",
            "occupation",
            "currentCompanyOrUniversity",
            "profilePhoto",
        ]

        for (const key of editable) {
            if (req.body[key] !== undefined) student[key] = req.body[key]
        }

        // Keep combined "name" in sync when firstName/lastName change
        if (req.body.firstName !== undefined || req.body.lastName !== undefined) {
            const combined = [student.firstName, student.lastName]
                .filter(Boolean)
                .join(" ")
                .trim()
            if (combined) student.name = combined
        }

        const updated = await student.save()
        res.json(sanitizeStudent(updated))
    } catch (err) {
        console.error("Profile update error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

export default router
