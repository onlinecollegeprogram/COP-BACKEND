import { Router } from "express"
import { sendEmail } from "../../lib/mail.js"
import crypto from "crypto"
import Invite from "../../models/Invite.js"
import User from "../../models/User.js"
import { connectDB } from "../../lib/db.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()

router.use(withClerk)
router.use(requireAdminAuth)

/**
 * @openapi
 * /api/auth/send-invite:
 *   post:
 *     tags: [Auth]
 *     summary: Send admin invitation email
 *     description: |
 *       Generates a one-time password-setup token, persists an Invite document, and emails the
 *       recipient a link to set their password (valid for 72 hours). Requires the caller to be
 *       either an `admin` or to have `users` in their `access` array.
 *
 *       If a `User` already exists for the email, their role/access are synchronized immediately.
 *     security:
 *       - clerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the user to invite
 *               role:
 *                 type: string
 *                 enum: [admin, viewer]
 *                 default: viewer
 *               access:
 *                 type: array
 *                 items: { type: string }
 *                 description: List of section keys the invitee can access
 *     responses:
 *       201:
 *         description: Invitation created and email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 invite: { $ref: '#/components/schemas/Invite' }
 *       400:
 *         description: Missing email or invalid role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthorized (no/invalid Clerk session)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Caller lacks permission to invite users
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Server error (email delivery, DB, etc.)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
// POST /api/auth/send-invite
router.post("/", async (req, res) => {
  try {
    await connectDB()

    // Only admins or users with "users" section access can invite
    const inviter = req.dbUser
    if (inviter.role !== "admin" && !inviter.access?.includes("users")) {
      return res.status(403).json({ error: "You don't have permission to invite users" })
    }

    const rawEmail = (req.body.email || "").trim().toLowerCase()
    const { access = [], role = "viewer" } = req.body

    if (!rawEmail) {
      return res.status(400).json({ error: "Email is required" })
    }
    if (!["admin", "viewer"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" })
    }

    // Generate raw token (sent in email) + hash (stored in DB)
    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours

    // Upsert invite
    const invite = await Invite.findOneAndUpdate(
      { email: rawEmail },
      {
        email: rawEmail,
        access,
        role,
        passwordSetupTokenHash: tokenHash,
        passwordSetupExpiresAt: expiresAt,
        status: "pending",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    // If a User already exists for this email (re-invite after password was set),
    // sync their role/access immediately so they don't have to click the new link.
    await User.findOneAndUpdate(
      { email: rawEmail },
      { role, access, isActive: true },
    )

    const baseUrl = process.env.APP_URL || "http://localhost:3000"
    const setPasswordLink = `${baseUrl}/admin/set-password?email=${encodeURIComponent(rawEmail)}&token=${rawToken}`

    await sendEmail({
      to: rawEmail,
      subject: "You are invited to COP CMS Admin",
      html: `
        <h2>You've been invited to COP CMS</h2>
        <p>You were invited to join the admin dashboard.</p>
        <p><a href="${setPasswordLink}">Set your password here</a> (valid for 72 hours)</p>
        <p>If the link doesn't work, copy this token on the Set Password page:</p>
        <code style="font-size:12px;word-break:break-all;background:#f0f0f0;padding:8px;display:block;">
          ${rawToken}
        </code>
      `,
    })

    res.status(201).json({
      success: true,
      message: "Invitation sent successfully",
      invite: {
        email: invite.email,
        role: invite.role,
        access: invite.access,
        status: invite.status,
      },
    })
  } catch (err) {
    console.error("❌ Send invite error:", err.message)
    res.status(500).json({ error: "Failed to send invitation" })
  }
})

export default router
