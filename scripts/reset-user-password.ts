import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error("Usage: npx tsx scripts/reset-user-password.ts <email> <password>");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { email }, data: { passwordHash } });
  console.log(`Password reset for ${email}`);
}

main().finally(() => prisma.$disconnect());
