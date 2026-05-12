import { Router } from "express"
import { clerkClient } from "@clerk/express"
import { connectDB } from "../../lib/db.js"
import User from "../../models/User.js"
import Invite from "../../models/Invite.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

/**
 * @openapi
 * /api/admin/users/self:
 *   get:
 *     tags: [Admin - Users]
 *     summary: Get the current admin user's profile
 *     description: Returns the requesting user's Clerk ID, email, role, and section access list.
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/users/self — get current user's role and access
router.get("/self", async (req, res) => {
  try {
    const user = req.dbUser // Already attached by requireAdminAuth
    res.json({
      userId: user.clerkId,
      email: user.email,
      role: user.role,
      access: user.access || [],
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin - Users]
 *     summary: List all active admin users
 *     description: Returns active users that have a non-null `clerkId`. The response shapes each user as `{ userId, userName, userEmail, role, access }`.
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: List of admin users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId: { type: string, description: Clerk user ID }
 *                       userName: { type: string }
 *                       userEmail: { type: string, format: email }
 *                       role: { type: string, enum: [admin, viewer] }
 *                       access:
 *                         type: array
 *                         items: { type: string }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/users — list all active users
router.get("/", async (req, res) => {
  try {
    await connectDB()

    const users = await User.find({ isActive: true, clerkId: { $exists: true, $ne: null } })
      .select("clerkId email role access isActive createdAt")
      .lean()

    const mappedUsers = users.map((u) => ({
      userId: u.clerkId,
      userName: u.email?.split("@")[0] || u.email,
      userEmail: u.email,
      role: u.role,
      access: u.access || [],
    }))

    res.json({ users: mappedUsers })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * @openapi
 * /api/admin/users/{id}:
 *   put:
 *     tags: [Admin - Users]
 *     summary: Update an admin user's access, role, or active state
 *     description: |
 *       The path `id` is the Clerk user ID (not the Mongo ObjectId). Only fields present in the
 *       body are updated.
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Clerk user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [admin, viewer] }
 *               access:
 *                 type: array
 *                 items: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Missing user ID
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: User not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// PUT /api/admin/users/:id — update user access/role/status by clerkId
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { access, isActive, role } = req.body

    if (!id) return res.status(400).json({ error: "User ID is required" })

    await connectDB()

    const updateData = {}
    if (access !== undefined) updateData.access = access
    if (isActive !== undefined) updateData.isActive = isActive
    if (role !== undefined) updateData.role = role

    const user = await User.findOneAndUpdate({ clerkId: id }, updateData, { new: true })
    if (!user) return res.status(404).json({ error: "User not found" })

    res.json({
      success: true,
      message: "User updated successfully",
      user: {
        userId: user.clerkId,
        email: user.email,
        role: user.role,
        access: user.access,
        isActive: user.isActive,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * @openapi
 * /api/admin/users/{id}:
 *   delete:
 *     tags: [Admin - Users]
 *     summary: Fully delete an admin user
 *     description: |
 *       Removes the user from Mongo, deletes any pending Invite matching their email, and deletes
 *       the corresponding Clerk user. Self-deletion is rejected.
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Clerk user ID
 *     responses:
 *       200:
 *         description: User fully removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *       400:
 *         description: Missing ID or attempt to self-delete
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: User not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/users/:id — delete user by clerkId (Mongo + Clerk + Invite)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: "User ID is required" })

    // Prevent self-delete
    if (req.dbUser?.clerkId === id) {
      return res.status(400).json({ error: "You cannot delete your own account" })
    }

    await connectDB()

    const user = await User.findOneAndDelete({ clerkId: id })
    if (!user) return res.status(404).json({ error: "User not found" })

    // Also remove any pending invite for this email so they can't reuse it
    await Invite.deleteMany({ email: user.email })

    // Delete the Clerk user so they can no longer authenticate
    try {
      await clerkClient.users.deleteUser(id)
      console.log(`✓ Deleted Clerk user: ${id}`)
    } catch (clerkErr) {
      // If Clerk user already gone, that's fine. Otherwise log and continue.
      console.error("⚠️ Failed to delete Clerk user:", clerkErr.message)
    }

    res.json({ success: true, message: `User ${user.email} has been fully removed` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
