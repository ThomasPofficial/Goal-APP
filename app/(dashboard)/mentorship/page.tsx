import { redirect } from "next/navigation";

export default async function LegacyMentorshipRedirect({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const params = await searchParams;
  redirect(params.conversation ? `/partnerships?conversation=${params.conversation}` : "/partnerships");
}
