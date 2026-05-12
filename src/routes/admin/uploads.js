import { Router } from "express"
import { uploadImage, uploadMedia } from "../../middleware/upload.js"
import { uploadBuffer, deleteAsset } from "../../lib/cloudinary.js"
import { withClerk, requireAdminAuth } from "../../middleware/auth.js"

const router = Router()
router.use(withClerk)
router.use(requireAdminAuth)

/**
 * @openapi
 * /api/admin/uploads/image:
 *   post:
 *     tags: [Admin - Uploads]
 *     summary: Upload an image to Cloudinary
 *     description: Accepts a single image file in the `file` field. Uses Cloudinary `resource_type=image`.
 *     security:
 *       - clerkAuth: []
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
 *               folder:
 *                 type: string
 *                 default: cop/admin
 *                 description: Optional Cloudinary folder
 *     responses:
 *       201:
 *         description: Upload successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url: { type: string }
 *                 secureUrl: { type: string }
 *                 publicId: { type: string }
 *                 width: { type: integer }
 *                 height: { type: integer }
 *                 format: { type: string }
 *                 bytes: { type: integer }
 *       400:
 *         description: No file uploaded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Upload failed, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/uploads/image
// multipart/form-data, field: "file", optional "folder"
router.post("/image", uploadImage.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" })
        const folder = (req.body.folder || "cop/admin").toString()
        const result = await uploadBuffer(req.file.buffer, { folder })
        res.status(201).json(result)
    } catch (err) {
        console.error("Admin upload error:", err.message)
        res.status(500).json({ error: err.message || "Upload failed" })
    }
})

/**
 * @openapi
 * /api/admin/uploads/media:
 *   post:
 *     tags: [Admin - Uploads]
 *     summary: Upload media (image, video, or PDF) to Cloudinary
 *     description: |
 *       Accepts a single file in the `file` field. The Cloudinary `resource_type` is auto-derived
 *       from the MIME type: `image/*` → image, `video/*` → video, `application/pdf` → raw, otherwise `auto`.
 *     security:
 *       - clerkAuth: []
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
 *               folder:
 *                 type: string
 *                 default: cop/admin
 *     responses:
 *       201:
 *         description: Upload successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url: { type: string }
 *                 secureUrl: { type: string }
 *                 publicId: { type: string }
 *                 resourceType: { type: string, enum: [image, video, raw, auto] }
 *                 mimeType: { type: string }
 *                 bytes: { type: integer }
 *       400:
 *         description: No file uploaded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Upload failed, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// POST /api/admin/uploads/media
// Accepts images, videos, and PDFs. Uses Cloudinary resource_type=auto.
router.post("/media", uploadMedia.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" })
        const folder = (req.body.folder || "cop/admin").toString()

        let resourceType = "auto"
        if (req.file.mimetype.startsWith("image/")) resourceType = "image"
        else if (req.file.mimetype.startsWith("video/")) resourceType = "video"
        else if (req.file.mimetype === "application/pdf") resourceType = "raw"

        const result = await uploadBuffer(req.file.buffer, { folder, resourceType })
        res.status(201).json({ ...result, resourceType, mimeType: req.file.mimetype })
    } catch (err) {
        console.error("Admin media upload error:", err.message)
        res.status(500).json({ error: err.message || "Upload failed" })
    }
})

/**
 * @openapi
 * /api/admin/uploads:
 *   delete:
 *     tags: [Admin - Uploads]
 *     summary: Delete a Cloudinary asset by publicId
 *     description: |
 *       The Cloudinary `publicId` is passed in the JSON body (not in the URL) to avoid issues with
 *       slashes inside the identifier.
 *     security:
 *       - clerkAuth: []
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
 *         description: Delete result from Cloudinary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result: { type: string, example: ok }
 *       400:
 *         description: publicId missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       500: { description: Delete failed, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
// DELETE /api/admin/uploads/:publicId*
// (use encoded publicId in body to avoid slash issues: { publicId })
router.delete("/", async (req, res) => {
    try {
        const { publicId } = req.body || {}
        if (!publicId) return res.status(400).json({ error: "publicId is required" })
        const result = await deleteAsset(publicId)
        res.json(result)
    } catch (err) {
        console.error("Admin upload delete error:", err.message)
        res.status(500).json({ error: err.message || "Delete failed" })
    }
})

export default router
