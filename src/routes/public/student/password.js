import { Router } from "express"
import crypto from "crypto"
import Student from "../../../models/Student.js"
import { connectDB } from "../../../lib/db.js"
import { requireStudentAuth } from "../../../middleware/studentAuth.js"
import { sendEmail } from "../../../lib/mail.js"

const router = Router()

// POST /api/public/student/password/forgot
// Body: { email } or { phone }
/**
 * @openapi
 * /api/public/student/password/forgot:
 *   post:
 *     tags: [Student - Auth]
 *     summary: Request a password reset link
 *     description: |
 *       Generates a 30-minute reset token and emails the reset URL to the student. Always
 *       responds 200 (regardless of whether the account exists) to prevent account enumeration.
 *       In non-production environments the response also includes `debugToken` for testing.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email, description: "Either `email` or `phone` is required." }
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Generic confirmation message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 debugToken: { type: string, description: "Only present in non-production." }
 *       400:
 *         description: Missing both email and phone
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.post("/forgot", async (req, res) => {
    try {
        await connectDB()
        const { email, phone } = req.body
        if (!email && !phone) {
            return res.status(400).json({ error: "Email or phone is required" })
        }

        const student = await Student.findOne({
            $or: [{ email: email || "" }, { phone: phone || "" }],
        })

        // Always respond 200 to prevent account enumeration
        if (!student) {
            return res.json({ message: "If an account exists, a reset link has been sent" })
        }

        const rawToken = crypto.randomBytes(32).toString("hex")
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex")

        student.resetPasswordToken = hashedToken
        student.resetPasswordExpires = new Date(Date.now() + 1000 * 60 * 30) // 30 min
        await student.save()

        const resetUrl =
            (process.env.FRONTEND_URL || "http://localhost:3000") +
            `/reset-password?token=${rawToken}`

        if (student.email && process.env.SMTP_HOST) {
            try {
                await sendEmail({
                    to: student.email,
                    subject: "Reset your CollegeProgram password",
                    text: `Reset your password within 30 minutes: ${resetUrl}`,
                    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 30 minutes.</p>`,
                })
            } catch (mailErr) {
                console.warn("Password reset email failed:", mailErr.message)
            }
        }

        const payload = { message: "If an account exists, a reset link has been sent" }
        if (process.env.NODE_ENV !== "production") {
            payload.debugToken = rawToken
        }
        res.json(payload)
    } catch (err) {
        console.error("Forgot password error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/public/student/password/reset
// Body: { token, newPassword, confirmPassword }
/**
 * @openapi
 * /api/public/student/password/reset:
 *   post:
 *     tags: [Student - Auth]
 *     summary: Reset a student's password using the token from the forgot-password email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string, description: "Raw token sent in the reset link." }
 *               newPassword: { type: string, minLength: 6 }
 *               confirmPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: Invalid/expired token, weak password, or password mismatch
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.post("/reset", async (req, res) => {
    try {
        await connectDB()
        const { token, newPassword, confirmPassword } = req.body
        if (!token || !newPassword) {
            return res.status(400).json({ error: "Token and new password are required" })
        }
        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            return res.status(400).json({ error: "Passwords do not match" })
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" })
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

        const student = await Student.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: new Date() },
        })

        if (!student) {
            return res.status(400).json({ error: "Invalid or expired reset token" })
        }

        student.password = newPassword
        student.resetPasswordToken = undefined
        student.resetPasswordExpires = undefined
        await student.save()

        res.json({ message: "Password has been reset successfully" })
    } catch (err) {
        console.error("Reset password error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/public/student/password/set   (authenticated, OAuth users only)
// Allows a student who signed up via OAuth (no password) to set a password
// so they can also log in with email/password going forward.
// Body: { newPassword, confirmPassword }
/**
 * @openapi
 * /api/public/student/password/set:
 *   post:
 *     tags: [Student - Auth]
 *     summary: Set an initial password (OAuth-only students)
 *     description: |
 *       Lets a student who signed up via OAuth and has no password on file set one so they
 *       can also sign in with email/password. Returns 409 if a password is already set.
 *     security:
 *       - studentAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: string, minLength: 6 }
 *               confirmPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password set
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: Missing/weak password or mismatch
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         description: Unauthorized
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       404:
 *         description: Student not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       409:
 *         description: A password is already set — use change-password instead
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.post("/set", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const { newPassword, confirmPassword } = req.body
        if (!newPassword) {
            return res.status(400).json({ error: "New password is required" })
        }
        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            return res.status(400).json({ error: "Passwords do not match" })
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" })
        }

        const student = await Student.findById(req.student._id).select("+password")
        if (!student) return res.status(404).json({ error: "Student not found" })

        if (student.password) {
            return res.status(409).json({
                error: "A password is already set. Use change password instead.",
            })
        }

        student.password = newPassword
        await student.save()

        res.json({ message: "Password set successfully" })
    } catch (err) {
        console.error("Set password error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

// PUT /api/public/student/password/change   (authenticated)
// Body: { currentPassword, newPassword, confirmPassword }
/**
 * @openapi
 * /api/public/student/password/change:
 *   put:
 *     tags: [Student - Auth]
 *     summary: Change the logged-in student's password
 *     security:
 *       - studentAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 6 }
 *               confirmPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: Missing/weak password or mismatch
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         description: Unauthorized or current password incorrect
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       404:
 *         description: Student not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.put("/change", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const { currentPassword, newPassword, confirmPassword } = req.body
        if (!currentPassword || !newPassword) {
            return res
                .status(400)
                .json({ error: "Current password and new password are required" })
        }
        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            return res.status(400).json({ error: "Passwords do not match" })
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" })
        }

        const student = await Student.findById(req.student._id)
        if (!student) return res.status(404).json({ error: "Student not found" })

        const match = await student.matchPassword(currentPassword)
        if (!match) return res.status(401).json({ error: "Current password is incorrect" })

        student.password = newPassword
        await student.save()

        res.json({ message: "Password updated successfully" })
    } catch (err) {
        console.error("Change password error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

export default router
