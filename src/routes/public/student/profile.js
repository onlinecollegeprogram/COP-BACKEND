import { Router } from "express"
import Student from "../../../models/Student.js"
import { connectDB } from "../../../lib/db.js"
import { requireStudentAuth } from "../../../middleware/studentAuth.js"
import { sanitizeStudent } from "../../../lib/studentToken.js"
import { deleteAsset } from "../../../lib/cloudinary.js"

const router = Router()

// GET /api/public/student/profile
router.get("/", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        // req.student excludes password (-password). Re-query with password
        // selected so we can expose a hasPassword flag without leaking the hash.
        const full = await Student.findById(req.student._id).select("+password")
        if (!full) return res.status(404).json({ error: "Student not found" })

        const obj = full.toObject()
        const hasPassword = !!obj.password
        delete obj.password
        delete obj.resetPasswordToken
        delete obj.resetPasswordExpires

        res.json({ ...obj, hasPassword })
    } catch (err) {
        console.error("Profile fetch error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

// PUT /api/public/student/profile
router.put("/", requireStudentAuth, async (req, res) => {
    try {
        await connectDB()
        const student = await Student.findById(req.student._id)
        if (!student) return res.status(404).json({ error: "Student not found" })

        const editable = [
            "name",
            "firstName",
            "lastName",
            "phone",
            "email",
            "courseOfInterest",
            "dateOfBirth",
            "city",
            "state",
            "country",
            "currentEducation",
            "occupation",
            "currentCompanyOrUniversity",
            "profilePhoto",
            "profilePhotoPublicId",
        ]

        // Cleanup old photo if being replaced or removed
        if (req.body.profilePhoto !== undefined || req.body.profilePhotoPublicId !== undefined) {
            const newPublicId = req.body.profilePhotoPublicId
            if (student.profilePhotoPublicId && (newPublicId === "" || newPublicId === null || (newPublicId && newPublicId !== student.profilePhotoPublicId))) {
                try {
                    await deleteAsset(student.profilePhotoPublicId)
                } catch (e) {
                    console.warn("Old photo delete failed:", e.message)
                }
            }
        }

        for (const key of editable) {
            if (req.body[key] !== undefined) student[key] = req.body[key]
        }

        // Keep combined "name" in sync when firstName/lastName change
        if (req.body.firstName !== undefined || req.body.lastName !== undefined) {
            const combined = [student.firstName, student.lastName]
                .filter(Boolean)
                .join(" ")
                .trim()
            if (combined) student.name = combined
        }

        const updated = await student.save()
        res.json(sanitizeStudent(updated))
    } catch (err) {
        console.error("Profile update error:", err.message)
        res.status(500).json({ error: "Internal server error" })
    }
})

export default router
