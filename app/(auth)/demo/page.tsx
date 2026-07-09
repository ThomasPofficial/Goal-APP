import { signIn } from "@/lib/auth";
import { GraduationCap, School } from "lucide-react";

async function loginStudent() {
  "use server";
  await signIn("credentials", {
    email: "thomas@piacentine.dev",
    password: "demo2026",
    redirectTo: "https://app.nivarro.co/dashboard",
  });
}

async function loginSchool() {
  "use server";
  await signIn("credentials", {
    email: "school@nivarro.demo",
    password: "demo2026",
    redirectTo: "https://app.nivarro.co/school/destinations",
  });
}

export default function DemoPage() {
  return (
    <div
      className="rounded-xl p-8"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-md)",
        boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
      }}
    >
      <div className="mb-8 text-center">
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 500, letterSpacing: "-0.5px", color: "var(--text)", marginBottom: 4 }}>
          Nivarro
        </h1>
        <h2 className="text-lg" style={{ color: "var(--text)", fontFamily: "var(--font-body, sans-serif)", fontWeight: 600 }}>
          See it in action
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
          One click, no login. Explore a live Westside Academy demo.
        </p>
      </div>

      <div className="space-y-4">
        <form action={loginStudent} className="w-full">
          <button
            type="submit"
            className="w-full flex items-center gap-4 py-5 px-6 text-left"
            style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: 8, cursor: "pointer" }}
          >
            <GraduationCap className="w-8 h-8 flex-shrink-0" style={{ color: "var(--amber, #E8893A)" }} />
            <span>
              <span className="block font-semibold text-lg">Explore as a Student</span>
              <span className="block text-sm mt-0.5" style={{ color: "var(--muted)" }}>Profile, community, mentorship</span>
            </span>
          </button>
        </form>

        <form action={loginSchool} className="w-full">
          <button
            type="submit"
            className="w-full flex items-center gap-4 py-5 px-6 text-left"
            style={{ background: "var(--amber, #E8893A)", color: "#000", borderRadius: 8, fontWeight: 600, boxShadow: "0 4px 20px rgba(232,137,58,0.35)", border: "none", cursor: "pointer" }}
          >
            <School className="w-8 h-8 flex-shrink-0" />
            <span>
              <span className="block font-semibold text-lg">Explore as a School Admin</span>
              <span className="block text-sm mt-0.5" style={{ opacity: 0.75 }}>Roster, brochure, communities, campaigns</span>
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
