import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { TRAITS } from "../data/traits";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding traits...");
  for (const trait of TRAITS) {
    await prisma.trait.upsert({
      where: { slug: trait.slug },
      create: { slug: trait.slug, name: trait.name, description: trait.description, category: trait.category },
      update: { name: trait.name, description: trait.description, category: trait.category },
    });
  }
  console.log(`Seeded ${TRAITS.length} traits.`);

  // Seed the Nivarro Team demo org (idempotent)
  const existing = await prisma.org.findFirst({ where: { name: "Nivarro Team" } });
  if (!existing) {
    console.log("Seeding Nivarro Team org...");

    // Use a placeholder createdById — the first user in the DB, or a fixed cuid
    const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    const creatorId = firstUser?.id ?? "seed-placeholder";

    const org = await prisma.org.create({
      data: {
        name: "Nivarro Team",
        tagline: "Help build the platform from the inside.",
        description:
          "Nivarro is looking for driven high school students to join our internal operations team. " +
          "You'll work directly on growing the platform — everything from community outreach and content creation " +
          "to UX feedback and ambassador programs. This is a chance to be part of building something from the ground up.",
        whatWeSeek:
          "Self-starters who communicate clearly, follow through on commitments, and care about building something real. " +
          "No prior experience required — just curiosity, work ethic, and a genuine interest in the platform's mission.",
        category: "FELLOWSHIP",
        status: "OPEN",
        accentColor: "#4A80F0",
        minTeamSize: 1,
        maxTeamSize: 4,
        format: "Remote",
        stipend: "Unpaid — equity in the community you help build",
        autoAccept: true,
        createdById: creatorId,
      },
    });

    await prisma.orgProject.create({
      data: {
        orgId: org.id,
        title: "Platform Growth & Community Team",
        description:
          "Join Nivarro's internal growth team. Responsibilities span community management, " +
          "ambassador outreach, content creation, and direct product feedback. " +
          "You'll be the first generation of the Nivarro Team — shaping what the platform becomes.",
        requiredSkills: JSON.stringify([
          "Communication",
          "Social Media",
          "Content Creation",
          "Community Building",
          "Research",
        ]),
        openSpots: 3,
        status: "OPEN",
      },
    });

    console.log("Nivarro Team org seeded.");
  } else {
    console.log("Nivarro Team org already exists — skipping.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
