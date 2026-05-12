import { Router } from "express"
import Student from "../../../models/Student.js"
import { connectDB } from "../../../lib/db.js"
import { generateStudentToken, sanitizeStudent } from "../../../lib/studentToken.js"

const router = Router()

// POST /api/public/student/google-auth
/**
 * @openapi
 * /api/public/student/google-auth:
 *   post:
 *     tags: [Student - Auth]
 *     summary: Sign in or sign up a student using a Google OAuth access token
 *     description: |
 *       Exchanges a Google OAuth access token for a student session. Existing accounts are
 *       linked (googleId stored) on first Google sign-in; unknown emails create a new account.
 *       Returns the sanitized student plus a JWT bearer token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accessToken]
 *             properties:
 *               accessToken:
 *                 type: string
 *                 description: Google OAuth access token (used to call Google's userinfo endpoint).
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Student'
 *                 - type: object
 *                   properties:
 *                     token: { type: string, description: JWT bearer token }
 *       400:
 *         description: Missing accessToken
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         description: Invalid Google token
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
        const { accessToken } = req.body

        if (!accessToken) {
            return res.status(400).json({ error: "Access token is required" })
        }

        // Fetch user info from Google using the access token
        const googleResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (!googleResponse.ok) {
            return res.status(401).json({ error: "Invalid Google token" })
        }

        const payload = await googleResponse.json();
        const { sub: googleId, email, name, picture, given_name, family_name } = payload

        let student = await Student.findOne({ $or: [{ googleId }, { email }] })

        if (student) {
            // Update googleId if not present (linked account)
            if (!student.googleId) {
                student.googleId = googleId
                if (picture && !student.profilePhoto) student.profilePhoto = picture
                await student.save()
            }
        } else {
            // Create new student
            student = await Student.create({
                googleId,
                email,
                name: name || `${given_name} ${family_name}`.trim(),
                firstName: given_name,
                lastName: family_name,
                profilePhoto: picture,
                isActive: true
            })
        }

        if (!student.isActive) {
            return res.status(403).json({ error: "Account is inactive" })
        }

        res.json({
            ...sanitizeStudent(student),
            token: generateStudentToken(student._id),
        })
    } catch (err) {
        console.error("Google Auth error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

export default router
