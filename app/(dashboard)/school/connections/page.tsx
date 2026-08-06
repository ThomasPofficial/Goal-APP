import { redirect } from "next/navigation";

// Chat Requests was blended into the Mentorship tab -- keep this route as a
// redirect so old bookmarks/links still land somewhere useful.
export default function SchoolConnectionsPage() {
  redirect("/school/mentorship");
}
