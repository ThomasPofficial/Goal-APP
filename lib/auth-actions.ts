"use server";

import { signOut } from "@/lib/auth";

export async function serverSignOut() {
  await signOut({ redirectTo: "/login" });
}
