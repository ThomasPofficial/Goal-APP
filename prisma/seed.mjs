import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

const pw = await bcrypt.hash("password123", 10);

// Alex
const alex = await prisma.user.upsert({
  where: { email: "demo@nivarro.io" },
  update: {},
  create: { email: "demo@nivarro.io", name: "Alex Morgan", passwordHash: pw },
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
    grade: 11,
    onboardingComplete: true,
    interests: JSON.stringify(["Startups", "AI / ML", "Systems Design", "Finance"]),
  },
});

// Jordan
const jordan = await prisma.user.upsert({
  where: { email: "jordan@nivarro.io" },
  update: {},
  create: { email: "jordan@nivarro.io", name: "Jordan Lee", passwordHash: pw },
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
    grade: 12,
    onboardingComplete: true,
    interests: JSON.stringify(["Leadership", "Psychology", "Film & Media", "Community Building"]),
  },
});

// Sam
const sam = await prisma.user.upsert({
  where: { email: "sam@nivarro.io" },
  update: {},
  create: { email: "sam@nivarro.io", name: "Sam Patel", passwordHash: pw },
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
    grade: 10,
    onboardingComplete: true,
    interests: JSON.stringify(["Engineering", "Research", "Productivity", "Science"]),
  },
});

// Project
const existing = await prisma.project.findFirst({ where: { name: "Nivarro Platform v1", createdById: alex.id } });
if (!existing) {
  await prisma.project.create({
    data: {
      name: "Nivarro Platform v1",
      goal: "Ship a working platform where ambitious people can connect and form effective teams",
      description: "Building the core product: profiles, projects, and org matching.",
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
    ],
  });
}

await prisma.$disconnect();
console.log("✅ Seed complete\n");
console.log("Demo accounts:");
console.log("  demo@nivarro.io    / password123");
console.log("  jordan@nivarro.io  / password123");
console.log("  sam@nivarro.io     / password123");
