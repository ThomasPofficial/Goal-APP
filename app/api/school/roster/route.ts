import { NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";
import { getSchoolRosterMembers } from "@/lib/school-roster";

export async function GET() {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

  const members = await getSchoolRosterMembers(schoolId);

  return NextResponse.json({ members });
}
