import { Router } from "express"
import Student from "../../../models/Student.js"
import { connectDB } from "../../../lib/db.js"
import { generateStudentToken, sanitizeStudent } from "../../../lib/studentToken.js"

const router = Router()

// POST /api/public/student/login
/**
 * @openapi
 * /api/public/student/login:
 *   post:
 *     tags: [Student - Auth]
 *     summary: Authenticate a student with email/phone + password
 *     description: |
 *       Accepts `email`, `phone`, or generic `identifier` plus `password`. On success returns
 *       the sanitized student record plus a JWT bearer token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               identifier: { type: string, description: "Generic alternative — accepts email or phone." }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Student'
 *                 - type: object
 *                   properties:
 *                     token: { type: string, description: JWT bearer token }
 *       400:
 *         description: Missing identifier or password
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         description: Incorrect credentials
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       403:
 *         description: Account is inactive
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.post("/", async (req, res) => {
    try {
        await connectDB()
        const { email, phone, identifier, password } = req.body

        const loginKey = email || phone || identifier
        if (!loginKey || !password) {
            return res
                .status(400)
                .json({ error: "Email or phone and password are required" })
        }

        const student = await Student.findOne({
            $or: [{ email: loginKey }, { phone: loginKey }],
        })

        if (!student || !(await student.matchPassword(password))) {
            return res.status(401).json({ error: "Incorrect credentials" })
        }

        if (!student.isActive) {
            return res.status(403).json({ error: "Account is inactive" })
        }

        res.json({
            ...sanitizeStudent(student),
            token: generateStudentToken(student._id),
        })
    } catch (err) {
        console.error("Login error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

export default router
