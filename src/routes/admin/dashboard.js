import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Course from "../../models/Course.js"
import Provider from "../../models/Provider.js"
import Leads from "../../models/Leads.js"
import Review from "../../models/Review.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

import DegreeType from "../../models/DegreeType.js"
import Specialization from "../../models/Specialization.js"
import ProviderCourse from "../../models/ProviderCourse.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

/**
 * @openapi
 * /api/admin/dashboard/stats:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get aggregate dashboard counts
 *     description: Returns document counts across the core collections used in the admin dashboard.
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Counts per collection
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 courses: { type: integer }
 *                 providers: { type: integer }
 *                 leads: { type: integer }
 *                 reviews: { type: integer }
 *                 degreeTypes: { type: integer }
 *                 specializations: { type: integer }
 *                 providerCourses: { type: integer }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/dashboard/stats
router.get("/stats", async (req, res) => {
  try {
    await connectDB()
    const [courses, providers, leads, reviews, degreeTypes, specializations, providerCourses] = await Promise.all([
      Course.countDocuments(),
      Provider.countDocuments(),
      Leads.countDocuments(),
      Review.countDocuments(),
      DegreeType.countDocuments(),
      Specialization.countDocuments(),
      ProviderCourse.countDocuments(),
    ])
    res.json({ courses, providers, leads, reviews, degreeTypes, specializations, providerCourses })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * @openapi
 * /api/admin/dashboard/leads-by-source:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Lead counts grouped by source
 *     description: Returns an aggregation of leads grouped by their `source` field.
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Array of `{ _id: source, count }`
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string, description: Source label }
 *                   count: { type: integer }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/dashboard/leads-by-source
router.get("/leads-by-source", async (req, res) => {
  try {
    await connectDB()
    const data = await Leads.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * @openapi
 * /api/admin/dashboard/reviews-by-rating:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Review counts grouped by star rating
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Array of `{ _id: rating, count }`
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: integer, description: Rating value (1–5) }
 *                   count: { type: integer }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// GET /api/admin/dashboard/reviews-by-rating
router.get("/reviews-by-rating", async (req, res) => {
  try {
    await connectDB()
    const data = await Review.aggregate([
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
