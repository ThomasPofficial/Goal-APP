import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

// Define traits inline for the seed
const TRAIT_CATEGORY = {
  VISION: "VISION", DRIVE: "DRIVE", LEADERSHIP: "LEADERSHIP",
  COMMUNICATION: "COMMUNICATION", COLLABORATION: "COLLABORATION",
  ORGANIZATION: "ORGANIZATION", ANALYTICAL: "ANALYTICAL",
  ADAPTABILITY: "ADAPTABILITY", INTEGRITY: "INTEGRITY", JUDGMENT: "JUDGMENT"
};

const TRAIT_SLUGS = [
  { slug: "visionary", name: "Visionary", description: "Thinks in long-term possibilities and big ideas.", category: "VISION" },
  { slug: "creative", name: "Creative", description: "Generates imaginative and original solutions.", category: "VISION" },
  { slug: "strategic", name: "Strategic", description: "Plans with long-term structure and foresight.", category: "VISION" },
  { slug: "curious", name: "Curious", description: "Always exploring new knowledge and ideas.", category: "VISION" },
  { slug: "innovative", name: "Innovative", description: "Constantly seeks better methods or products.", category: "VISION" },
  { slug: "futurist", name: "Futurist", description: "Focused on emerging trends and technologies.", category: "VISION" },
  { slug: "conceptual-thinker", name: "Conceptual Thinker", description: "Understands abstract systems and models.", category: "VISION" },
  { slug: "ambitious", name: "Ambitious", description: "Highly motivated to achieve big goals.", category: "DRIVE" },
  { slug: "self-starter", name: "Self-Starter", description: "Takes initiative without needing direction.", category: "DRIVE" },
  { slug: "persistent", name: "Persistent", description: "Pushes through obstacles and setbacks.", category: "DRIVE" },
  { slug: "competitive", name: "Competitive", description: "Motivated by challenge and winning.", category: "DRIVE" },
  { slug: "resilient", name: "Resilient", description: "Recovers quickly from failure or stress.", category: "DRIVE" },
  { slug: "hardworking", name: "Hardworking", description: "Consistently puts in strong effort.", category: "DRIVE" },
  { slug: "charismatic", name: "Charismatic", description: "Naturally inspires and energizes others.", category: "LEADERSHIP" },
  { slug: "decisive", name: "Decisive", description: "Makes decisions confidently and quickly.", category: "LEADERSHIP" },
  { slug: "vision-executor", name: "Vision-Executor", description: "Turns ideas into real outcomes.", category: "LEADERSHIP" },
  { slug: "motivator", name: "Motivator", description: "Encourages others to perform at their best.", category: "LEADERSHIP" },
  { slug: "confident", name: "Confident", description: "Projects assurance and leadership presence.", category: "LEADERSHIP" },
  { slug: "communicative", name: "Communicative", description: "Shares ideas clearly and listens well.", category: "COMMUNICATION" },
  { slug: "empathetic", name: "Empathetic", description: "Understands and respects others' feelings.", category: "COMMUNICATION" },
  { slug: "diplomatic", name: "Diplomatic", description: "Handles conflict with tact and balance.", category: "COMMUNICATION" },
  { slug: "approachable", name: "Approachable", description: "Easy for others to talk to.", category: "COMMUNICATION" },
  { slug: "persuasive", name: "Persuasive", description: "Skilled at influencing opinions.", category: "COMMUNICATION" },
  { slug: "storyteller", name: "Storyteller", description: "Explains ideas through engaging narratives.", category: "COMMUNICATION" },
  { slug: "cooperative", name: "Cooperative", description: "Works smoothly with teammates.", category: "COLLABORATION" },
  { slug: "supportive", name: "Supportive", description: "Encourages and assists others.", category: "COLLABORATION" },
  { slug: "connector", name: "Connector", description: "Builds strong networks and relationships.", category: "COLLABORATION" },
  { slug: "mentor", name: "Mentor", description: "Helps others grow and develop skills.", category: "COLLABORATION" },
  { slug: "community-builder", name: "Community-Builder", description: "Creates strong group culture.", category: "COLLABORATION" },
  { slug: "organized", name: "Organized", description: "Keeps work structured and planned.", category: "ORGANIZATION" },
  { slug: "reliable", name: "Reliable", description: "Consistently follows through on commitments.", category: "ORGANIZATION" },
  { slug: "disciplined", name: "Disciplined", description: "Maintains routines and focus.", category: "ORGANIZATION" },
  { slug: "punctual", name: "Punctual", description: "Respects time and deadlines.", category: "ORGANIZATION" },
  { slug: "systematic", name: "Systematic", description: "Approaches work step-by-step.", category: "ORGANIZATION" },
  { slug: "analytical", name: "Analytical", description: "Makes decisions using logic and data.", category: "ANALYTICAL" },
  { slug: "problem-solver", name: "Problem-Solver", description: "Finds effective solutions quickly.", category: "ANALYTICAL" },
  { slug: "critical-thinker", name: "Critical Thinker", description: "Challenges assumptions and ideas.", category: "ANALYTICAL" },
  { slug: "detail-oriented", name: "Detail-Oriented", description: "Notices small errors and refinements.", category: "ANALYTICAL" },
  { slug: "objective", name: "Objective", description: "Makes fair, unbiased judgments.", category: "ANALYTICAL" },
  { slug: "adaptable", name: "Adaptable", description: "Adjusts easily to change.", category: "ADAPTABILITY" },
  { slug: "fast-learner", name: "Fast Learner", description: "Quickly picks up new skills.", category: "ADAPTABILITY" },
  { slug: "experimenter", name: "Experimenter", description: "Likes testing new approaches.", category: "ADAPTABILITY" },
  { slug: "explorer", name: "Explorer", description: "Seeks out unfamiliar opportunities.", category: "ADAPTABILITY" },
  { slug: "trustworthy", name: "Trustworthy", description: "Acts with honesty and reliability.", category: "INTEGRITY" },
  { slug: "ethical", name: "Ethical", description: "Guided by strong moral principles.", category: "INTEGRITY" },
  { slug: "responsible", name: "Responsible", description: "Takes ownership of outcomes.", category: "INTEGRITY" },
  { slug: "accountable", name: "Accountable", description: "Accepts consequences and learns from them.", category: "INTEGRITY" },
  { slug: "risk-taker", name: "Risk-Taker", description: "Willing to pursue bold opportunities.", category: "JUDGMENT" },
  { slug: "calculated-risk-taker", name: "Calculated Risk-Taker", description: "Takes risks with analysis.", category: "JUDGMENT" },
  { slug: "pragmatic", name: "Pragmatic", description: "Focuses on practical results.", category: "JUDGMENT" },
];

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

console.log("🌱 Seeding traits...");
for (const trait of TRAIT_SLUGS) {
  await prisma.trait.upsert({
    where: { slug: trait.slug },
    update: { name: trait.name, description: trait.description, category: trait.category },
    create: trait,
  });
}
console.log(`✅ Seeded ${TRAIT_SLUGS.length} traits`);

const pw = await bcrypt.hash("password123", 10);

// Alex (Dynamo)
const alex = await prisma.user.upsert({
  where: { email: "demo@nivarro.io" },
  update: {},
  create: { email: "demo@nivarro.io", name: "Alex Morgan", passwordHash: pw },
});
const alexTraits = await prisma.trait.findMany({
  where: { slug: { in: ["visionary", "analytical", "decisive", "connector", "fast-learner"] } },
});
const alexProfile = await prisma.profile.upsert({
  where: { userId: alex.id },
  update: { onboardingComplete: true, handle: "alexmorgan" },
  create: {
    userId: alex.id, displayName: "Alex Morgan",
    handle: "alexmorgan",
    headline: "Builder & Systems Thinker",
    bio: "I build platforms that help ambitious people find each other and do their best work together.",
    strengthSummary: "Strong at seeing patterns across complex systems and translating vision into executable plans.",
    geniusType: "DYNAMO",
    grade: 11,
    onboardingComplete: true,
    interests: JSON.stringify(["Startups", "AI / ML", "Systems Design", "Finance"]),
  },
});
for (let i = 0; i < alexTraits.length; i++) {
  await prisma.profileTrait.upsert({
    where: { profileId_traitId: { profileId: alexProfile.id, traitId: alexTraits[i].id } },
    update: {}, create: { profileId: alexProfile.id, traitId: alexTraits[i].id, order: i },
  });
}

// Jordan (Blaze)
const jordan = await prisma.user.upsert({
  where: { email: "jordan@nivarro.io" },
  update: {},
  create: { email: "jordan@nivarro.io", name: "Jordan Lee", passwordHash: pw },
});
const jordanTraits = await prisma.trait.findMany({
  where: { slug: { in: ["charismatic", "motivator", "empathetic", "storyteller", "cooperative"] } },
});
const jordanProfile = await prisma.profile.upsert({
  where: { userId: jordan.id },
  update: { onboardingComplete: true, handle: "jordanlee" },
  create: {
    userId: jordan.id, displayName: "Jordan Lee",
    handle: "jordanlee",
    headline: "Team Builder & People Leader",
    bio: "The best products are built by teams who genuinely understand each other.",
    strengthSummary: "Exceptional at aligning teams around a shared vision and keeping morale high.",
    geniusType: "BLAZE",
    grade: 12,
    onboardingComplete: true,
    interests: JSON.stringify(["Leadership", "Psychology", "Film & Media", "Community Building"]),
  },
});
for (let i = 0; i < jordanTraits.length; i++) {
  await prisma.profileTrait.upsert({
    where: { profileId_traitId: { profileId: jordanProfile.id, traitId: jordanTraits[i].id } },
    update: {}, create: { profileId: jordanProfile.id, traitId: jordanTraits[i].id, order: i },
  });
}

// Sam (Tempo)
const sam = await prisma.user.upsert({
  where: { email: "sam@nivarro.io" },
  update: {},
  create: { email: "sam@nivarro.io", name: "Sam Patel", passwordHash: pw },
});
const samTraits = await prisma.trait.findMany({
  where: { slug: { in: ["organized", "reliable", "disciplined", "systematic", "detail-oriented"] } },
});
const samProfile = await prisma.profile.upsert({
  where: { userId: sam.id },
  update: { onboardingComplete: true, handle: "sampatel" },
  create: {
    userId: sam.id, displayName: "Sam Patel",
    handle: "sampatel",
    headline: "Operations & Execution Lead",
    bio: "I turn ambitious plans into running systems.",
    strengthSummary: "Unmatched at building operational backbone. Reliable, thorough, the reason things don't fall apart.",
    geniusType: "TEMPO",
    grade: 10,
    onboardingComplete: true,
    interests: JSON.stringify(["Engineering", "Research", "Productivity", "Science"]),
  },
});
for (let i = 0; i < samTraits.length; i++) {
  await prisma.profileTrait.upsert({
    where: { profileId_traitId: { profileId: samProfile.id, traitId: samTraits[i].id } },
    update: {}, create: { profileId: samProfile.id, traitId: samTraits[i].id, order: i },
  });
}

// Project
const existing = await prisma.project.findFirst({ where: { name: "Nivarro Platform v1", createdById: alex.id } });
if (!existing) {
  await prisma.project.create({
    data: {
      name: "Nivarro Platform v1",
      goal: "Ship a working platform where ambitious people can connect and form effective teams",
      description: "Building the core product: profiles, traits, skill cards, projects, and peer endorsements.",
      createdById: alex.id, status: "ACTIVE",
      members: {
        createMany: {
          data: [
            { userId: alex.id, role: "OWNER" },
            { userId: jordan.id, role: "MEMBER" },
            { userId: sam.id, role: "MEMBER" },
          ],
        },
      },
    },
  });
}

// Notes
const existingNote = await prisma.note.findFirst({ where: { authorId: alex.id } });
if (!existingNote) {
  await prisma.note.createMany({
    data: [
      { authorId: alex.id, title: "Product Vision", content: "The platform should feel like walking into a research library — quiet, focused, full of people doing serious work.", pinned: true },
      { authorId: alex.id, title: "Team composition insight", content: "Best teams have at least one Dynamo, one Blaze, and one Tempo/Steel. The magic happens at those intersections." },
      { authorId: alex.id, content: "Peer endorsements are the key differentiator. They turn self-reported traits into verified strengths over time." },
    ],
  });
}

await prisma.$disconnect();
console.log("✅ Seed complete\n");
console.log("Demo accounts:");
console.log("  demo@nivarro.io    / password123  ⚡ Dynamo");
console.log("  jordan@nivarro.io  / password123  🔥 Blaze");
console.log("  sam@nivarro.io     / password123  🎵 Tempo");
