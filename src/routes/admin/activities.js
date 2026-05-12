import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Activity from "../../models/Activity.js"
import { getActivityLogs, getActivityCount } from "../../lib/activityLogger.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()

// Apply Clerk middleware to all routes in this router
router.use(withClerk)
router.use(requireAdminAuth)

/**
 * @openapi
 * /api/admin/activities:
 *   get:
 *     tags: [Admin - Activities]
 *     summary: List activity log entries
 *     description: Returns paginated activity log entries, optionally filtered by user or section.
 *     security:
 *       - clerkAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *         description: Filter by Clerk user ID that produced the activity
 *       - in: query
 *         name: section
 *         schema: { type: string }
 *         description: Filter by section (e.g. "courses", "providers")
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: skip
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Paginated list of activity logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       userId: { type: string }
 *                       userName: { type: string }
 *                       userEmail: { type: string, format: email }
 *                       action: { type: string, example: create }
 *                       section: { type: string, example: courses }
 *                       itemId: { type: string }
 *                       itemName: { type: string }
 *                       details: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 skip: { type: integer }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/activities — get logs with filters + pagination
router.get("/", async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId || null,
      section: req.query.section || null,
      limit: parseInt(req.query.limit) || 50,
      skip: parseInt(req.query.skip) || 0,
    }

    // Remove nulls
    Object.keys(filters).forEach(
      (k) => (filters[k] === null || filters[k] === undefined) && delete filters[k]
    )

    const [logs, total] = await Promise.all([
      getActivityLogs(filters),
      getActivityCount(filters),
    ])

    res.json({ logs, total, limit: filters.limit, skip: filters.skip })
  } catch (err) {
    console.error("Error fetching activities:", err)
    res.status(500).json({ error: "Failed to fetch activities", details: err.message })
  }
})

/**
 * @openapi
 * /api/admin/activities/clear:
 *   delete:
 *     tags: [Admin - Activities]
 *     summary: Clear all activity logs
 *     description: Removes every activity log entry. Destructive — admin only.
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Logs cleared
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 deletedCount: { type: integer }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/activities/clear — delete all activity logs
router.delete("/clear", async (req, res) => {
  try {
    await connectDB()
    const result = await Activity.deleteMany({})
    res.json({ success: true, deletedCount: result.deletedCount })
  } catch (err) {
    console.error("Error clearing activities:", err)
    res.status(500).json({ error: "Failed to clear activities", details: err.message })
  }
})

export default router
