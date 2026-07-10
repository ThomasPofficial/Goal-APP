import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isWalledStudent } from "@/lib/accountGate";
import MentorshipClient from "./MentorshipClient";

export default async function MentorshipPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!(await isWalledStudent(session.user.id))) redirect("/dashboard");

  return <MentorshipClient myUserId={session.user.id} />;
}
