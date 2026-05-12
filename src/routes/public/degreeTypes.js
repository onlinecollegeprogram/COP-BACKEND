import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import DegreeType from "../../models/DegreeType.js"

const router = Router()

// GET /api/public/degree-types — list all active degree types
/**
 * @openapi
 * /api/public/degree-types:
 *   get:
 *     tags: [Public - Degree Types]
 *     summary: List all active degree types
 *     description: Returns active degree types sorted ascending by `order`.
 *     responses:
 *       200:
 *         description: Array of degree types
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   name: { type: string }
 *                   slug: { type: string }
 *                   order: { type: integer }
 *                   isActive: { type: boolean }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const types = await DegreeType.find({ isActive: true }).sort({ order: 1 })
    res.json(types)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch degree types", details: err.message })
  }
})

export default router
