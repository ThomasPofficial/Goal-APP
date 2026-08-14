/**
 * Whether a profile may be the target of a personal "donate to me" (the
 * Donation model / /give/[handle] flow) — as opposed to a school-campaign
 * donation (CampaignPledge), which already only ever notifies the school.
 *
 * Current students, school admin accounts, and staff/teachers (whether via
 * the STAFF role or the older roster-created STUDENT+staffTitle pattern)
 * are never eligible: nobody should be personally soliciting or receiving
 * donation money through this platform. Alumni (isAlumni=true) are adults
 * and remain eligible, along with ORG and ADMIN accounts.
 */
export function canReceiveDonations(
  user: { role: string; isAlumni: boolean },
  profile: { staffTitle: string | null }
): boolean {
  if (user.role === "SCHOOL" || user.role === "STAFF") return false;
  if (profile.staffTitle) return false;
  if (user.role === "STUDENT" && !user.isAlumni) return false;
  return true;
}
