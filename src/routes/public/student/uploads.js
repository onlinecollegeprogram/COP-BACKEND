import { Router } from "express"
import { uploadImage } from "../../../middleware/upload.js"
import { uploadBuffer, deleteAsset } from "../../../lib/cloudinary.js"
import { requireStudentAuth } from "../../../middleware/studentAuth.js"

const router = Router()

// POST /api/public/student/uploads/image
/**
 * @openapi
 * /api/public/student/uploads/image:
 *   post:
 *     tags: [Student - Profile]
 *     summary: Upload an image to the logged-in student's Cloudinary folder
 *     description: |
 *       Accepts a single `file` field (multipart/form-data). Files are uploaded to
 *       `cop/students/{studentId}` and the Cloudinary asset is returned.
 *     security:
 *       - studentAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Upload result (Cloudinary asset)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicId: { type: string }
 *                 url: { type: string }
 *                 secureUrl: { type: string }
 *       400:
 *         description: No file uploaded
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         description: Unauthorized
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Upload failed
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.post("/image", requireStudentAuth, uploadImage.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" })
        const folder = `cop/students/${req.student._id}`
        const result = await uploadBuffer(req.file.buffer, { folder })
        res.status(201).json(result)
    } catch (err) {
        console.error("Student upload error:", err.message)
        res.status(500).json({ error: err.message || "Upload failed" })
    }
})

// DELETE /api/public/student/uploads
// Body: { publicId }
/**
 * @openapi
 * /api/public/student/uploads:
 *   delete:
 *     tags: [Student - Profile]
 *     summary: Delete a previously uploaded Cloudinary asset
 *     description: |
 *       For safety, the `publicId` must start with `cop/students/{studentId}/` — students
 *       can only delete assets from their own folder.
 *     security:
 *       - studentAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [publicId]
 *             properties:
 *               publicId: { type: string }
 *     responses:
 *       200:
 *         description: Cloudinary delete result
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: publicId missing
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         description: Unauthorized
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       403:
 *         description: publicId is outside the student's folder
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       500:
 *         description: Delete failed
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.delete("/", requireStudentAuth, async (req, res) => {
    try {
        const { publicId } = req.body || {}
        if (!publicId) return res.status(400).json({ error: "publicId is required" })
        // Safety: only allow deleting from this student's folder
        if (!publicId.startsWith(`cop/students/${req.student._id}/`)) {
            return res.status(403).json({ error: "Cannot delete this asset" })
        }
        const result = await deleteAsset(publicId)
        res.json(result)
    } catch (err) {
        console.error("Student upload delete error:", err.message)
        res.status(500).json({ error: err.message || "Delete failed" })
    }
})

export default router
