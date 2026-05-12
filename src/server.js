import "dotenv/config" // Ensure environment variables are loaded first
import express from "express"
import cors from "cors"
import morgan from "morgan"
import swaggerUi from "swagger-ui-express"
import { connectDB } from "./lib/db.js"
import { swaggerSpec } from "./lib/swagger.js"

// ── Route imports ─────────────────────────────────────────────────────────────
// Admin routes (Clerk-protected)
import activitiesRouter from "./routes/admin/activities.js"

import coursesRouter from "./routes/admin/courses.js"
import dashboardRouter from "./routes/admin/dashboard.js"
import degreeTypesRouter from "./routes/admin/degreeTypes.js"
import leadsAdminRouter from "./routes/admin/leads.js"
import pagesRouter from "./routes/admin/pages.js"
import providerCoursesRouter from "./routes/admin/providerCourses.js"
import providersRouter from "./routes/admin/providers.js"
import reviewsRouter from "./routes/admin/reviews.js"
import specializationsRouter from "./routes/admin/specializations.js"
import usersRouter from "./routes/admin/users.js"
import studentsRouter from "./routes/admin/students.js"
import uploadsRouter from "./routes/admin/uploads.js"

// Auth routes (custom invite system)
import authRouter from "./routes/auth/index.js"

// Public routes (no auth)
import publicRouter from "./routes/public/index.js"


// ── App setup ─────────────────────────────────────────────────────────────────
const app = express()
const PORT = process.env.PORT || 5000

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`))
      }
    },
    credentials: true,
  })
)

// ── General middleware ─────────────────────────────────────────────────────────
app.use(morgan("dev"))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// ── API documentation (Swagger UI) ────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "COP API Docs",
  swaggerOptions: { persistAuthorization: true },
}))
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec))

// ── Mount routes ──────────────────────────────────────────────────────────────

// Auth (invite + set-password) — no Clerk required
app.use("/api/auth", authRouter)

// Public endpoints — no auth
app.use("/api/public", publicRouter)



// Admin routes — all protected by Clerk + section access
app.use("/api/admin/activities", activitiesRouter)
app.use("/api/admin/courses", coursesRouter)
app.use("/api/admin/dashboard", dashboardRouter)
app.use("/api/admin/degree-types", degreeTypesRouter)
app.use("/api/admin/leads", leadsAdminRouter)
app.use("/api/admin/pages", pagesRouter)
app.use("/api/admin/provider-courses", providerCoursesRouter)
app.use("/api/admin/providers", providersRouter)
app.use("/api/admin/reviews", reviewsRouter)
app.use("/api/admin/specializations", specializationsRouter)
app.use("/api/admin/students", studentsRouter)
app.use("/api/admin/uploads", uploadsRouter)
app.use("/api/admin/users", usersRouter)

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.message)
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  })
})

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`)
      console.log(`📦 Environment: ${process.env.NODE_ENV}`)
    })
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err.message)
    process.exit(1)
  })
