import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import QuizClient from "./QuizClient";

export default async function QuizPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { geniusType: true },
  });

  // If quiz already done, show result page (handled in client)
  return (
    <QuizClient
      alreadyCompleted={!!profile?.geniusType}
      existingType={profile?.geniusType ?? null}
    />
  );
}
