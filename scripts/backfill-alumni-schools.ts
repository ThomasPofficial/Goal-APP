import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const alumniProfiles = await prisma.profile.findMany({
    where: { schoolId: { not: null }, user: { isAlumni: true } },
    select: { id: true, schoolId: true, userId: true },
  });

  console.log(`Found ${alumniProfiles.length} alumni profile(s) with a schoolId to migrate.`);

  let linked = 0;
  for (const profile of alumniProfiles) {
    await prisma.alumniSchool.upsert({
      where: { profileId_schoolId: { profileId: profile.id, schoolId: profile.schoolId! } },
      create: { profileId: profile.id, schoolId: profile.schoolId! },
      update: {},
    });
    linked++;
  }
  console.log(`Linked ${linked} AlumniSchool row(s).`);

  const { count } = await prisma.profile.updateMany({
    where: { schoolId: { not: null }, user: { isAlumni: true } },
    data: { schoolId: null },
  });
  console.log(`Nulled Profile.schoolId on ${count} alumni row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
