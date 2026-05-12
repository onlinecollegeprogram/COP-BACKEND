import mongoose from "mongoose"

const providerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String },
    coverImage: { type: String },
    coverDescription: { type: String },
    galleryImages: [{ type: String }],
    galleryDescription: { type: mongoose.Schema.Types.Mixed },
    shortExcerpt: { type: String },
    contentBlocks: [{ type: mongoose.Schema.Types.Mixed }], // For Tiptap and Images
    isFeatured: { type: Boolean, default: false },
    bestROI: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    isActive: { type: String, enum: ["active", "inactive"], default: "active" },
    publicationStatus: { type: String, enum: ["draft", "published"], default: "draft" },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    ratingBreakdown: {
      averageRating: { type: Number, default: 0 },
      digitalInfrastructure: { type: Number, default: 0 },
      curriculum: { type: Number, default: 0 },
      valueForMoney: { type: Number, default: 0 },
    },
    aboutContent: { type: mongoose.Schema.Types.Mixed },
    admissionProcess: { type: mongoose.Schema.Types.Mixed },
    financialAid: { type: mongoose.Schema.Types.Mixed },
    examinationPattern: { type: mongoose.Schema.Types.Mixed },
    careerServices: { type: mongoose.Schema.Types.Mixed },
    additionalContent: { type: mongoose.Schema.Types.Mixed },
    scholarshipDescription: { type: mongoose.Schema.Types.Mixed },
    scholarships: [{ category: String, scholarshipCredit: String, eligibility: String }],
    approvalsDescription: { type: mongoose.Schema.Types.Mixed },
    approvals: [{ name: String, logo: String }],
    rankingsDescription: { type: mongoose.Schema.Types.Mixed },
    rankings: [{ title: String, description: String }],
    factsDescription: { type: mongoose.Schema.Types.Mixed },
    facts: [{ icon: String, text: mongoose.Schema.Types.Mixed }],
    placementPartnersDescription: { type: mongoose.Schema.Types.Mixed },
    placementPartners: [{ name: String, logo: String }],
    sampleCertificateDescription: { type: mongoose.Schema.Types.Mixed },
    sampleCertificateImage: { type: String },
    admissionOpen: {
      isOpen: { type: Boolean, default: false },
      year: String,
      text: String,
      description: { type: mongoose.Schema.Types.Mixed },
    },
    admissionOpenDescription: { type: mongoose.Schema.Types.Mixed },
    campuses: [{ city: String, state: String, country: String }],
    faq: [{ question: String, answer: String }],
    whoShouldChoosePoints: [{ text: String }],
    comparison: {
      location: { type: String },
      feesStartingFrom: { type: Number },
      duration: { type: String },
      intakePeriod: { type: String },
      timeCommitment: { type: String },
      totalSeatsAvailable: { type: Number },
      overallRating: { type: Number },
      accreditation: { type: String },
      placementRate: { type: Number },
      averageSalary: { type: Number },
      eligibility: { type: String },
      minimumRequirements: { type: String },
      ugcDebStatus: { type: Boolean, default: false },
      naacGrade: { type: String },
      examType: { type: String },
      roiScore: { type: String },
    },
    metaTitle: String,
    metaDescription: String,
    metaKeywords: String,
    canonicalUrl: String,
    ogTitle: String,
    ogDescription: String,
    ogImage: String,
    twitterTitle: String,
    twitterDescription: String,
    twitterImage: String,
    noindex: { type: Boolean, default: false },
  },
  { timestamps: true }
)


providerSchema.index({ isActive: 1 })
providerSchema.index({ isFeatured: -1 })
providerSchema.index({ bestROI: 1 })
providerSchema.index({ trending: 1 })
providerSchema.index({ name: "text", shortExcerpt: "text" })

providerSchema.pre("save", async function (next) {
  // Multiple providers can be marked as bestROI simultaneously.
  // Only enforce single-trending: one trending provider at a time.
  if (this.trending) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { trending: false } }
    );
  }
  next();
});

export default mongoose.models.Provider || mongoose.model("Provider", providerSchema, "providers")
