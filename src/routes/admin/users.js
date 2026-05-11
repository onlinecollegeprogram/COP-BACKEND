import { Router } from "express"
import { clerkClient } from "@clerk/express"
import { connectDB } from "../../lib/db.js"
import User from "../../models/User.js"
import Invite from "../../models/Invite.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

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
