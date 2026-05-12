import swaggerJsdoc from "swagger-jsdoc"

const isProduction = process.env.NODE_ENV === "production"

const servers = []
if (isProduction) {
  servers.push({
    url: "https://limegreen-cassowary-419552.hostingersite.com",
    description: "Production (Hostinger)",
  })
}
servers.push({
  url: `http://localhost:${process.env.PORT || 5000}`,
  description: "Local development",
})

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "COP Backend API",
      version: "1.0.0",
      description:
        "REST API for the COP (College Program) CMS and public website. " +
        "Admin endpoints require a Clerk JWT. Student endpoints use a JWT issued at sign-in.",
      contact: {
        name: "COP",
        email: "onlinecollegeprogram@gmail.com",
      },
    },
    servers,
    tags: [
      { name: "Auth", description: "Admin invitation and password setup" },
      { name: "Admin - Pages", description: "Page schemas and content (Clerk required)" },
      { name: "Admin - Providers", description: "Universities/providers (Clerk required)" },
      { name: "Admin - Courses", description: "Courses (Clerk required)" },
      { name: "Admin - Provider Courses", description: "Provider/course mappings (Clerk required)" },
      { name: "Admin - Specializations", description: "Course specializations (Clerk required)" },
      { name: "Admin - Degree Types", description: "Degree types (Clerk required)" },
      { name: "Admin - Leads", description: "Lead management (Clerk required)" },
      { name: "Admin - Reviews", description: "Review moderation (Clerk required)" },
      { name: "Admin - Students", description: "Student management (Clerk required)" },
      { name: "Admin - Users", description: "Admin user management (Clerk required)" },
      { name: "Admin - Activities", description: "Activity log (Clerk required)" },
      { name: "Admin - Dashboard", description: "Dashboard metrics (Clerk required)" },
      { name: "Admin - Uploads", description: "Cloudinary uploads (Clerk required)" },
      { name: "Admin - Blogs", description: "Blog management (Clerk required)" },
      { name: "Public - Pages", description: "Public page content" },
      { name: "Public - Providers", description: "Public provider listings" },
      { name: "Public - Courses", description: "Public course listings" },
      { name: "Public - Degree Types", description: "Public degree types" },
      { name: "Public - Specializations", description: "Public specializations" },
      { name: "Public - Provider Courses", description: "Public provider/course mappings" },
      { name: "Public - Leads", description: "Lead form submission" },
      { name: "Public - Reviews", description: "Review submission" },
      { name: "Student - Auth", description: "Student authentication" },
      { name: "Student - Profile", description: "Student profile and account" },
      { name: "Student - Shortlist", description: "Student shortlist" },
    ],
    components: {
      securitySchemes: {
        clerkAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Clerk JWT for admin endpoints",
        },
        studentAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Student JWT issued by /api/public/student/login or /api/public/student/google-auth",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Something went wrong" },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
          },
        },
        User: {
          type: "object",
          properties: {
            userId: { type: "string", description: "Clerk user id", example: "user_2abc..." },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["admin", "editor", "viewer"] },
            access: { type: "array", items: { type: "string" } },
            isActive: { type: "boolean" },
          },
        },
        Invite: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["admin", "viewer"] },
            access: { type: "array", items: { type: "string" } },
            status: { type: "string", example: "pending" },
          },
        },
        Provider: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            shortExcerpt: { type: "string" },
            isActive: { type: "boolean" },
            isFeatured: { type: "boolean" },
            publicationStatus: { type: "string", enum: ["draft", "published"] },
          },
        },
        Course: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            description: { type: "string" },
          },
        },
        ProviderCourse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            providerId: { type: "string" },
            courseId: { type: "string" },
            specializationId: { type: "string" },
            slug: { type: "string" },
            trending: { type: "boolean" },
            bestROI: { type: "boolean" },
            isActive: { type: "boolean" },
          },
        },
        Lead: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            message: { type: "string" },
            callStatus: { type: "string" },
            assignedTo: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Review: {
          type: "object",
          properties: {
            _id: { type: "string" },
            reviewerName: { type: "string" },
            reviewerEmail: { type: "string", format: "email" },
            rating: { type: "integer", minimum: 1, maximum: 5 },
            title: { type: "string" },
            comment: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
        Student: {
          type: "object",
          properties: {
            _id: { type: "string" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            phone: { type: "string" },
            googleId: { type: "string" },
            profilePhoto: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/**/*.js"],
}

export const swaggerSpec = swaggerJsdoc(options)
