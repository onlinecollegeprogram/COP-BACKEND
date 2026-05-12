import { Router } from "express"
import { connectDB } from "../../lib/db.js"
import Provider from "../../models/Provider.js"
import Review from "../../models/Review.js"
import ProviderCourse from "../../models/ProviderCourse.js"

const router = Router()

// GET /api/public/providers/programs/best-roi — courses from bestROI providers
/**
 * @openapi
 * /api/public/providers/programs/best-roi:
 *   get:
 *     tags: [Public - Providers]
 *     summary: Programs from "Best ROI" providers
 *     description: |
 *       Returns courses from all active providers flagged `bestROI: true`. Providers with
 *       no active courses are still returned as a placeholder card so the section never blanks.
 *     responses:
 *       200:
 *         description: Array of program cards
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   title: { type: string }
 *                   slug: { type: string }
 *                   thumbnail: { type: string, nullable: true }
 *                   fees: { type: number }
 *                   discountedFees: { type: number }
 *                   duration: { type: string, nullable: true }
 *                   trending: { type: boolean }
 *                   certifications:
 *                     type: array
 *                     items: { type: string }
 *                   features:
 *                     type: array
 *                     items: { type: string }
 *                   rating: { type: number }
 *                   providerName: { type: string }
 *                   providerSlug: { type: string }
 *                   providerLogo: { type: string }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/programs/best-roi", async (req, res) => {
  try {
    await connectDB()

    // Find all active providers marked as bestROI
    const bestROIProviders = await Provider.find({ bestROI: true, isActive: "active" })
      .select("name slug logo coverImage averageRating trending shortExcerpt")

    if (!bestROIProviders.length) return res.json([])

    const providerIds = bestROIProviders.map((p) => p._id)

    // Build a lookup map: providerId → provider
    const providerMap = {}
    for (const p of bestROIProviders) {
      providerMap[p._id.toString()] = p
    }

    // Fetch active ProviderCourses for these providers
    const courses = await ProviderCourse.find({
      providerId: { $in: providerIds },
      isActive: true,
    })
      .select("providerId title slug thumbnail fees discountedFees duration trending approvals highlights")
      .sort({ trending: -1, createdAt: -1 })

    // Track which providers have at least one course
    const providersWithCourses = new Set()

    const result = courses.map((c) => {
      const provider = providerMap[c.providerId?.toString()] || {}
      providersWithCourses.add(c.providerId?.toString())
      return {
        _id: c._id,
        title: c.title,
        slug: c.slug,
        thumbnail: c.thumbnail || provider.coverImage || null,
        fees: c.fees,
        discountedFees: c.discountedFees,
        duration: c.duration,
        trending: c.trending || provider.trending || false,
        certifications: c.approvals || [],
        features: c.highlights || [],
        rating: provider.averageRating || 0,
        providerName: provider.name || "",
        providerSlug: provider.slug || "",
        providerLogo: provider.logo || "",
      }
    })

    // For bestROI providers with NO courses, add a provider-level placeholder card
    for (const p of bestROIProviders) {
      if (!providersWithCourses.has(p._id.toString())) {
        result.push({
          _id: `provider-${p._id}`,
          title: p.name,
          slug: p.slug,
          thumbnail: p.coverImage || null,
          fees: 0,
          discountedFees: 0,
          duration: null,
          trending: p.trending || false,
          certifications: [],
          features: p.shortExcerpt ? [p.shortExcerpt] : [],
          rating: p.averageRating || 0,
          providerName: p.name || "",
          providerSlug: p.slug || "",
          providerLogo: p.logo || "",
        })
      }
    }

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch best ROI programs", details: err.message })
  }
})

// GET /api/public/providers/programs/trending — courses from trending providers/courses
/**
 * @openapi
 * /api/public/providers/programs/trending:
 *   get:
 *     tags: [Public - Providers]
 *     summary: Trending programs (course-level OR provider-level)
 *     description: |
 *       Returns up to 20 ProviderCourses that are either course-level trending or belong to
 *       a provider flagged as trending. Sorted by `trending` desc then `createdAt` desc.
 *     responses:
 *       200:
 *         description: Array of trending program cards
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   title: { type: string }
 *                   slug: { type: string }
 *                   thumbnail: { type: string, nullable: true }
 *                   fees: { type: number }
 *                   discountedFees: { type: number }
 *                   duration: { type: string, nullable: true }
 *                   trending: { type: boolean }
 *                   certifications:
 *                     type: array
 *                     items: { type: string }
 *                   features:
 *                     type: array
 *                     items: { type: string }
 *                   rating: { type: number }
 *                   providerName: { type: string }
 *                   providerSlug: { type: string }
 *                   providerLogo: { type: string }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/programs/trending", async (req, res) => {
  try {
    await connectDB()

    // Find active providers marked as trending
    const trendingProviders = await Provider.find({ trending: true, isActive: "active" })
      .select("name slug logo coverImage averageRating trending shortExcerpt")

    const providerMap = {}
    for (const p of trendingProviders) {
      providerMap[p._id.toString()] = p
    }

    const providerIds = trendingProviders.map((p) => p._id)

    // Fetch trending ProviderCourses (either course-level or from trending providers)
    const courses = await ProviderCourse.find({
      $or: [
        { trending: true, isActive: true },
        { providerId: { $in: providerIds }, isActive: true },
      ],
    })
      .select("providerId title slug thumbnail fees discountedFees duration trending approvals highlights")
      .sort({ trending: -1, createdAt: -1 })
      .limit(20)

    // Build full provider map including providers from course-level trending
    const extraProviderIds = courses
      .map((c) => c.providerId?.toString())
      .filter((id) => id && !providerMap[id])
    if (extraProviderIds.length) {
      const extraProviders = await Provider.find({ _id: { $in: extraProviderIds } })
        .select("name slug logo coverImage averageRating trending shortExcerpt")
      for (const p of extraProviders) providerMap[p._id.toString()] = p
    }

    const result = courses.map((c) => {
      const provider = providerMap[c.providerId?.toString()] || {}
      return {
        _id: c._id,
        title: c.title,
        slug: c.slug,
        thumbnail: c.thumbnail || provider.coverImage || null,
        fees: c.fees,
        discountedFees: c.discountedFees,
        duration: c.duration,
        trending: c.trending || provider.trending || false,
        certifications: c.approvals || [],
        features: c.highlights || [],
        rating: provider.averageRating || 0,
        providerName: provider.name || "",
        providerSlug: provider.slug || "",
        providerLogo: provider.logo || "",
      }
    })

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trending programs", details: err.message })
  }
})

// GET /api/public/providers — list all published providers
/**
 * @openapi
 * /api/public/providers:
 *   get:
 *     tags: [Public - Providers]
 *     summary: List all active providers
 *     description: Returns active providers sorted with featured first, then newest. Supports a `featured` query filter.
 *     parameters:
 *       - in: query
 *         name: featured
 *         required: false
 *         schema: { type: string, enum: ["true"] }
 *         description: Pass `true` to restrict to featured providers.
 *     responses:
 *       200:
 *         description: Array of providers (selected listing fields)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Provider' }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/", async (req, res) => {
  try {
    await connectDB()
    const query = { isActive: "active" }
    if (req.query.featured === "true") query.isFeatured = true

    const providers = await Provider.find(query)
      .select("name slug logo coverImage galleryImages shortExcerpt facts approvals admissionOpen isFeatured averageRating reviewCount comparison ratingBreakdown")
      .sort({ isFeatured: -1, createdAt: -1 })

    res.json(providers)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch providers", details: err.message })
  }
})

// GET /api/public/providers/:slug — single provider page
/**
 * @openapi
 * /api/public/providers/{slug}:
 *   get:
 *     tags: [Public - Providers]
 *     summary: Get a single active provider by slug or id
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: Provider slug or ObjectId.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Provider document
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Provider' }
 *       404:
 *         description: Provider not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/:slug", async (req, res) => {
  try {
    await connectDB()
    const identifier = req.params.slug
    const isObjectId = identifier.match(/^[0-9a-fA-F]{24}$/)
    
    const query = isObjectId 
      ? { _id: identifier, isActive: "active" }
      : { slug: identifier, isActive: "active" }

    const provider = await Provider.findOne(query)

    if (!provider) return res.status(404).json({ error: "Provider not found" })

    res.json(provider)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch provider", details: err.message })
  }
})

// GET /api/public/providers/:slug/reviews — active reviews for a provider
/**
 * @openapi
 * /api/public/providers/{slug}/reviews:
 *   get:
 *     tags: [Public - Providers]
 *     summary: Get active reviews for a provider
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: Provider slug or ObjectId.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of active reviews (newest first)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Review' }
 *       404:
 *         description: Provider not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/:slug/reviews", async (req, res) => {
  try {
    await connectDB()
    const identifier = req.params.slug
    const isObjectId = identifier.match(/^[0-9a-fA-F]{24}$/)
    
    const query = isObjectId ? { _id: identifier } : { slug: identifier }
    const provider = await Provider.findOne(query)
    
    if (!provider) return res.status(404).json({ error: "Provider not found" })

    const reviews = await Review.find({ providerId: provider._id, isActive: true })
      .sort({ createdAt: -1 })

    res.json(reviews)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reviews", details: err.message })
  }
})

// GET /api/public/providers/:slug/courses — courses for a provider
/**
 * @openapi
 * /api/public/providers/{slug}/courses:
 *   get:
 *     tags: [Public - Providers]
 *     summary: Get active provider courses for a provider
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: Provider slug or ObjectId.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of provider courses with degreeType, course, and specialization populated
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ProviderCourse' }
 *       404:
 *         description: Provider not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/:slug/courses", async (req, res) => {
  try {
    await connectDB()
    const identifier = req.params.slug
    const isObjectId = identifier.match(/^[0-9a-fA-F]{24}$/)
    
    const query = isObjectId ? { _id: identifier } : { slug: identifier }
    const provider = await Provider.findOne(query)
    
    if (!provider) return res.status(404).json({ error: "Provider not found" })

    const courses = await ProviderCourse.find({ providerId: provider._id, isActive: true })
      .populate("degreeTypeId")
      .populate("courseId")
      .populate("specializationId")

    res.json(courses)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch courses", details: err.message })
  }
})

export default router
