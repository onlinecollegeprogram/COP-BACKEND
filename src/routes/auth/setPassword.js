import { Router } from "express"
import crypto from "crypto"
import { clerkClient } from "@clerk/express"
import Invite from "../../models/Invite.js"
import User from "../../models/User.js"
import { connectDB } from "../../lib/db.js"

const router = Router()

// Constant-time string comparison to prevent timing attacks
function constantTimeCompare(a, b) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * @openapi
 * /api/auth/set-password:
 *   post:
 *     tags: [Auth]
 *     summary: Complete invitation and set admin password
 *     description: |
 *       Public endpoint (no auth) used by invited users to finalize their account. Verifies the
 *       invite token (constant-time compare against a SHA-256 hash), creates or updates the Clerk
 *       user with the supplied password, upserts the local `User` document, and deletes the
 *       consumed Invite.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, token, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               token:
 *                 type: string
 *                 description: Raw token from the invitation link
 *               password:
 *                 type: string
 *                 format: password
 *                 description: New password for the admin account
 *     responses:
 *       200:
 *         description: Password set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string, format: email }
 *                     role: { type: string, enum: [admin, viewer] }
 *       400:
 *         description: Missing email, token, or password
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Invalid invitation token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Invitation not found for this email
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       410:
 *         description: Invitation has expired
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Server error (Clerk or DB failure)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
// POST /api/auth/set-password
router.post("/", async (req, res) => {
  try {
    await connectDB()

    const email = (req.body.email || "").trim().toLowerCase()
    const { token, password } = req.body

    if (!email || !token || !password) {
      return res.status(400).json({ error: "Email, token, and password are required" })
    }

    // Find invite
    const invite = await Invite.findOne({ email })
    if (!invite) {
      return res.status(404).json({ error: "Invitation not found" })
    }

    // Check expiry
    if (new Date() > invite.passwordSetupExpiresAt) {
      await Invite.deleteOne({ _id: invite._id })
      return res.status(410).json({ error: "Invitation has expired. Please request a new one." })
    }

    // Verify token (constant-time comparison)
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
    if (!constantTimeCompare(tokenHash, invite.passwordSetupTokenHash)) {
      return res.status(401).json({ error: "Invalid invitation token" })
    }

    // Create or update user in Clerk
    let clerkUser
    try {
      const existingUsers = await clerkClient.users.getUserList({ emailAddress: [email] })

      if (existingUsers.data.length > 0) {
        clerkUser = existingUsers.data[0]
        await clerkClient.users.updateUser(clerkUser.id, { password })
        console.log(`✓ Updated Clerk user: ${clerkUser.id}`)
      } else {
        clerkUser = await clerkClient.users.createUser({
          emailAddress: [email],
          password,
        })
        console.log(`✓ Created Clerk user: ${clerkUser.id}`)
      }
    } catch (clerkErr) {
      console.error("❌ Clerk error:", clerkErr.message)
      return res.status(500).json({
        error: `Failed to create/update user account: ${clerkErr.message}`,
      })
    }

    // Upsert User in MongoDB
    const user = await User.findOneAndUpdate(
      { clerkId: clerkUser.id },
      {
        clerkId: clerkUser.id,
        email,
        role: invite.role,
        access: invite.access,
        isActive: true,
        metadata: {
          invitedAt: invite.createdAt,
          acceptedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    )

    // Delete the invite after successful setup
    await Invite.deleteOne({ _id: invite._id })

    res.status(200).json({
      success: true,
      message: "Password set successfully. You can now log in.",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    })
  } catch (err) {
    console.error(" Set password error:", err.message)
    res.status(500).json({ error: "Failed to set password" })
  }
})

export default router
