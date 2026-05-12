import { Router } from "express"
import Student from "../../../models/Student.js"
import { connectDB } from "../../../lib/db.js"
import { requireStudentAuth } from "../../../middleware/studentAuth.js"
import { sanitizeStudent } from "../../../lib/studentToken.js"
import { deleteAsset } from "../../../lib/cloudinary.js"

const router = Router()

const isValidPhotoUrl = (v) => {
    if (typeof v !== "string" || !v.trim()) return false
    return /^https?:\/\//i.test(v) || v.startsWith("/") || v.startsWith("data:image/")
}

// GET /api/public/student/photo — get current profile photo URL
/**
 * @openapi
 * /api/public/student/photo:
 *   get:
 *     tags: [Student - Profile]
 *     summary: Get the logged-in student's profile photo URL
 *     security:
 *       - studentAuth: []
 *     responses:
 *       200:
 *         description: Current profile photo URL (or null)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profilePhoto: { type: string, nullable: true }
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
        const student = await Student.findById(req.student._id).select("profilePhoto")
        if (!student) return res.status(404).json({ error: "Student not found" })
        res.json({ profilePhoto: student.profilePhoto || null })
    } catch (err) {
        console.error("Photo get error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/public/student/photo — add/set profile photo (when none exists or overwrite)
// Body: { profilePhoto: "<url | data:image/... >" }
/**
 * @openapi
 * /api/public/student/photo:
 *   post:
 *     tags: [Student - Profile]
 *     summary: Set or overwrite the logged-in student's profile photo
 *     description: |
 *       Accepts a URL, root-relative path, or `data:image/...` data URI. If a previous Cloudinary
 *       asset is on file, it is best-effort deleted.
 *     security:
 *       - studentAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [profilePhoto]
 *             properties:
 *               profilePhoto: { type: string, description: "Image URL or data URI." }
 *               profilePhotoPublicId: { type: string, description: "Cloudinary public id (optional)." }
 *     responses:
 *       201:
 *         description: Photo set
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 profilePhoto: { type: string }
 *                 student: { $ref: '#/components/schemas/Student' }
 *       400:
 *         description: Invalid profilePhoto value
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
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
router.post("/", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const { profilePhoto, profilePhotoPublicId } = req.body || {}
        if (!isValidPhotoUrl(profilePhoto)) {
            return res
                .status(400)
                .json({ error: "profilePhoto must be a valid URL or data URI" })
        }

        const student = await Student.findById(req.student._id)
        if (!student) return res.status(404).json({ error: "Student not found" })

        // If replacing, delete the previous Cloudinary asset (best-effort)
        if (student.profilePhotoPublicId && student.profilePhotoPublicId !== profilePhotoPublicId) {
            try { await deleteAsset(student.profilePhotoPublicId) } catch (e) { console.warn("Old photo delete failed:", e.message) }
        }
        student.profilePhoto = profilePhoto.trim()
        student.profilePhotoPublicId = profilePhotoPublicId || undefined
        await student.save()
        res.status(201).json({
            message: "Profile photo set",
            profilePhoto: student.profilePhoto,
            student: sanitizeStudent(student),
        })
    } catch (err) {
        console.error("Photo set error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

// PUT /api/public/student/photo — update profile photo
// Body: { profilePhoto }
/**
 * @openapi
 * /api/public/student/photo:
 *   put:
 *     tags: [Student - Profile]
 *     summary: Update the logged-in student's profile photo
 *     description: Same payload as POST. Best-effort deletes the prior Cloudinary asset if changed.
 *     security:
 *       - studentAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [profilePhoto]
 *             properties:
 *               profilePhoto: { type: string }
 *               profilePhotoPublicId: { type: string }
 *     responses:
 *       200:
 *         description: Photo updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 profilePhoto: { type: string }
 *                 student: { $ref: '#/components/schemas/Student' }
 *       400:
 *         description: Invalid profilePhoto value
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
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
router.put("/", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const { profilePhoto, profilePhotoPublicId } = req.body || {}
        if (!isValidPhotoUrl(profilePhoto)) {
            return res
                .status(400)
                .json({ error: "profilePhoto must be a valid URL or data URI" })
        }

        const student = await Student.findById(req.student._id)
        if (!student) return res.status(404).json({ error: "Student not found" })

        // If replacing, delete the previous Cloudinary asset (best-effort)
        if (student.profilePhotoPublicId && student.profilePhotoPublicId !== profilePhotoPublicId) {
            try { await deleteAsset(student.profilePhotoPublicId) } catch (e) { console.warn("Old photo delete failed:", e.message) }
        }
        student.profilePhoto = profilePhoto.trim()
        student.profilePhotoPublicId = profilePhotoPublicId || undefined
        await student.save()
        res.json({
            message: "Profile photo updated",
            profilePhoto: student.profilePhoto,
            student: sanitizeStudent(student),
        })
    } catch (err) {
        console.error("Photo update error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

// DELETE /api/public/student/photo — remove profile photo
/**
 * @openapi
 * /api/public/student/photo:
 *   delete:
 *     tags: [Student - Profile]
 *     summary: Remove the logged-in student's profile photo
 *     description: Clears the photo fields and best-effort deletes the Cloudinary asset.
 *     security:
 *       - studentAuth: []
 *     responses:
 *       200:
 *         description: Photo removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
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
router.delete("/", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const student = await Student.findById(req.student._id)
        if (!student) return res.status(404).json({ error: "Student not found" })

        if (student.profilePhotoPublicId) {
            try { await deleteAsset(student.profilePhotoPublicId) } catch (e) { console.warn("Photo delete failed:", e.message) }
        }
        student.profilePhoto = undefined
        student.profilePhotoPublicId = undefined
        await student.save()
        res.json({ message: "Profile photo removed" })
    } catch (err) {
        console.error("Photo delete error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

export default router
