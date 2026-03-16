import { PrismaClient } from "@prisma/client";
import { TRAITS } from "../data/traits";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding traits...");

  for (const trait of TRAITS) {
    await prisma.trait.upsert({
      where: { slug: trait.slug },
      create: {
        slug: trait.slug,
        name: trait.name,
        description: trait.description,
        category: trait.category,
      },
      update: {
        name: trait.name,
        description: trait.description,
        category: trait.category,
      },
    });
  }

  console.log(`Seeded ${TRAITS.length} traits.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
