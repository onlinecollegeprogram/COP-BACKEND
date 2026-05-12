import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Specialization from "../../models/Specialization.js"
import ProviderCourse from "../../models/ProviderCourse.js"

const router = Router()

// GET /api/public/specializations — list all active specializations
/**
 * @openapi
 * /api/public/specializations:
 *   get:
 *     tags: [Public - Specializations]
 *     summary: List all active specializations with provider counts
 *     description: |
 *       Returns active specializations with `courseId` populated. Each result has a computed
 *       `providerCount` equal to the number of unique providers offering active courses
 *       under that specialization.
 *     responses:
 *       200:
 *         description: Array of specializations
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
 *                   courseId:
 *                     type: object
 *                     description: Populated Course document
 *                   isActive: { type: boolean }
 *                   providerCount: { type: integer }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const specializations = await Specialization.find({ isActive: true }).populate("courseId").lean()
    
    // Get provider counts for each specialization
    // We count unique providerIds that have at least one active ProviderCourse for that specialization
    const counts = await ProviderCourse.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$specializationId", providerIds: { $addToSet: "$providerId" } } },
      { $project: { _id: 1, count: { $size: "$providerIds" } } }
    ])
    
    const countsMap = {}
    counts.forEach(c => {
      if (c._id) {
        countsMap[c._id.toString()] = c.count
      }
    })
    
    const results = specializations.map(s => ({
      ...s,
      providerCount: countsMap[s._id.toString()] || 0
    }))
    
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch specializations", details: err.message })
  }
})

// GET /api/public/specializations/:identifier/providers — list all providers offering this specialization
/**
 * @openapi
 * /api/public/specializations/{identifier}/providers:
 *   get:
 *     tags: [Public - Specializations]
 *     summary: List unique active providers that offer a specialization
 *     description: Resolves the specialization by slug or ObjectId, then returns the unique active providers offering it via ProviderCourse.
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema: { type: string }
 *         description: Specialization slug or ObjectId.
 *     responses:
 *       200:
 *         description: Array of unique providers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Provider' }
 *       404:
 *         description: Specialization not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/:identifier/providers", async (req, res) => {
  try {
    await connectDB()
    const identifier = req.params.identifier
    const isObjectId = identifier.match(/^[0-9a-fA-F]{24}$/)
    
    const query = isObjectId ? { _id: identifier } : { slug: identifier }
    const specialization = await Specialization.findOne(query)
    
    if (!specialization) return res.status(404).json({ error: "Specialization not found" })

    const providerCourses = await ProviderCourse.find({ specializationId: specialization._id, isActive: true })
      .populate("providerId")
    
    // Extract unique providers
    const providersMap = {}
    providerCourses.forEach(pc => {
      if (pc.providerId && pc.providerId.isActive === "active") {
        providersMap[pc.providerId._id.toString()] = pc.providerId
      }
    })

    res.json(Object.values(providersMap))
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch providers for specialization", details: err.message })
  }
})

export default router

