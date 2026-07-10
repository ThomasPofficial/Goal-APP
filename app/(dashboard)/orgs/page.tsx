import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isWalledStudent } from "@/lib/accountGate";
import OrgsClient from "./OrgsClient";

export default async function OrgsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (await isWalledStudent(session.user.id)) redirect("/dashboard");

  return <OrgsClient />;
}
