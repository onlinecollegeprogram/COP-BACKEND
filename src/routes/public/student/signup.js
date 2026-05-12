import { Router } from "express"
import Student from "../../../models/Student.js"
import { connectDB } from "../../../lib/db.js"
import { generateStudentToken, sanitizeStudent } from "../../../lib/studentToken.js"

const router = Router()

// POST /api/public/student/signup
/**
 * @openapi
 * /api/public/student/signup:
 *   post:
 *     tags: [Student - Auth]
 *     summary: Register a new student
 *     description: |
 *       Creates a new Student account using email and/or phone plus a password.
 *       Returns the sanitized student plus a freshly minted JWT for use as a Bearer token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               name: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string, format: email, description: "Either `email` or `phone` is required." }
 *               phone: { type: string }
 *               password: { type: string, minLength: 6 }
 *               confirmPassword: { type: string }
 *               courseOfInterest: { type: string }
 *               dateOfBirth: { type: string, format: date }
 *               city: { type: string }
 *               state: { type: string }
 *               country: { type: string }
 *               currentEducation: { type: string }
 *               occupation: { type: string }
 *               currentCompanyOrUniversity: { type: string }
 *     responses:
 *       201:
 *         description: Student created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Student'
 *                 - type: object
 *                   properties:
 *                     token: { type: string, description: JWT bearer token }
 *       400:
 *         description: Missing required fields or weak/mismatched password
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       409:
 *         description: Account already exists with this email or phone
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.post("/", async (req, res) => {
    try {
        await connectDB()
        const {
            name,
            firstName,
            lastName,
            email,
            phone,
            password,
            confirmPassword,
            courseOfInterest,
            dateOfBirth,
            city,
            state,
            country,
            currentEducation,
            occupation,
            currentCompanyOrUniversity,
        } = req.body

        if (!email && !phone) {
            return res.status(400).json({ error: "Email or phone number is required" })
        }
        if (!password) {
            return res.status(400).json({ error: "Password is required" })
        }
        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({ error: "Passwords do not match" })
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" })
        }

        const existsQuery = []
        if (email) existsQuery.push({ email })
        if (phone) existsQuery.push({ phone })
        if (existsQuery.length) {
            const existing = await Student.findOne({ $or: existsQuery })
            if (existing) {
                return res
                    .status(409)
                    .json({ error: "Account already exists with this email or phone" })
            }
        }

        const fullName =
            name || [firstName, lastName].filter(Boolean).join(" ").trim() || undefined

        const student = await Student.create({
            name: fullName,
            firstName,
            lastName,
            email,
            phone,
            password,
            courseOfInterest,
            dateOfBirth,
            city,
            state,
            country,
            currentEducation,
            occupation,
            currentCompanyOrUniversity,
        })

        return res.status(201).json({
            ...sanitizeStudent(student),
            token: generateStudentToken(student._id),
        })
    } catch (err) {
        console.error("Signup error:", err.message)
        if (err.message.includes("email or phone")) {
            return res.status(400).json({ error: err.message })
        }
        res.status(500).json({ error: "Internal server error" })
    }
})

export default router
