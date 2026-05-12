import { Router } from "express"
import Student from "../../../models/Student.js"
import { connectDB } from "../../../lib/db.js"
import { requireStudentAuth } from "../../../middleware/studentAuth.js"

const router = Router()

// GET /api/public/student/shortlist — list shortlisted universities
/**
 * @openapi
 * /api/public/student/shortlist:
 *   get:
 *     tags: [Student - Shortlist]
 *     summary: List the logged-in student's shortlisted universities
 *     security:
 *       - studentAuth: []
 *     responses:
 *       200:
 *         description: Array of shortlisted universities
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   providerId: { type: string }
 *                   name: { type: string }
 *                   logo: { type: string }
 *                   rating: { type: number }
 *                   approvals:
 *                     type: array
 *                     items: { type: string }
 *                   startingFee: { type: number }
 *                   minimumDuration: { type: string }
 *                   courses:
 *                     type: array
 *                     items: { type: object }
 *                   states:
 *                     type: array
 *                     items: { type: string }
 *       401:
 *         description: Unauthorized
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       404:
 *         description: Student not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.get("/", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const student = await Student.findById(req.student._id).select(
            "shortlistedUniversities"
        )
        if (!student) return res.status(404).json({ error: "Student not found" })
        res.json(student.shortlistedUniversities || [])
    } catch (err) {
        console.error("Shortlist list error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/public/student/shortlist — add a university
/**
 * @openapi
 * /api/public/student/shortlist:
 *   post:
 *     tags: [Student - Shortlist]
 *     summary: Add a university to the logged-in student's shortlist
 *     description: At least one of `providerId` or `name` is required. Returns 409 if already shortlisted.
 *     security:
 *       - studentAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               providerId: { type: string }
 *               name: { type: string }
 *               logo: { type: string }
 *               rating: { type: number }
 *               approvals:
 *                 type: array
 *                 items: { type: string }
 *               startingFee: { type: number }
 *               minimumDuration: { type: string }
 *               courses:
 *                 type: array
 *                 items: { type: object }
 *               states:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: Updated shortlist
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: object }
 *       400:
 *         description: providerId or name required
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         description: Unauthorized
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       404:
 *         description: Student not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       409:
 *         description: University already in shortlist
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.post("/", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const student = await Student.findById(req.student._id)
        if (!student) return res.status(404).json({ error: "Student not found" })

        const {
            providerId,
            name,
            logo,
            rating,
            approvals = [],
            startingFee,
            minimumDuration,
            courses = [],
            states = [],
        } = req.body

        if (!name && !providerId) {
            return res
                .status(400)
                .json({ error: "providerId or university name is required" })
        }

        const existing = student.shortlistedUniversities.find((item) => {
            if (providerId && item.providerId?.toString() === providerId.toString())
                return true
            return name && item.name === name
        })

        if (existing) {
            return res.status(409).json({ error: "University already in shortlist" })
        }

        student.shortlistedUniversities.push({
            providerId,
            name,
            logo,
            rating,
            approvals,
            startingFee,
            minimumDuration,
            courses,
            states,
        })
        await student.save()

        res.status(201).json(student.shortlistedUniversities)
    } catch (err) {
        console.error("Shortlist add error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

// DELETE /api/public/student/shortlist/:providerId — remove from shortlist
/**
 * @openapi
 * /api/public/student/shortlist/{providerId}:
 *   delete:
 *     tags: [Student - Shortlist]
 *     summary: Remove a university from the logged-in student's shortlist
 *     security:
 *       - studentAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: University removed; returns the updated shortlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 shortlistedUniversities:
 *                   type: array
 *                   items: { type: object }
 *       401:
 *         description: Unauthorized
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       404:
 *         description: Student or shortlist entry not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Server error
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.delete("/:providerId", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const student = await Student.findById(req.student._id)
        if (!student) return res.status(404).json({ error: "Student not found" })

        const { providerId } = req.params
        const originalCount = student.shortlistedUniversities.length
        student.shortlistedUniversities = student.shortlistedUniversities.filter(
            (item) => item.providerId?.toString() !== providerId.toString()
        )

        if (student.shortlistedUniversities.length === originalCount) {
            return res.status(404).json({ error: "Shortlist item not found" })
        }

        await student.save()
        res.json({
            message: "University removed from shortlist",
            shortlistedUniversities: student.shortlistedUniversities,
        })
    } catch (err) {
        console.error("Shortlist remove error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

export default router
