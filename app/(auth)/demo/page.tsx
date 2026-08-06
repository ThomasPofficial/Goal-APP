import { signIn } from "@/lib/auth";
import { GraduationCap, School } from "lucide-react";
import { DemoSubmitButton } from "./DemoSubmitButton";

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
    redirectTo: "https://app.nivarro.co/campaigns",
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
          <DemoSubmitButton
            icon={<GraduationCap className="w-8 h-8 flex-shrink-0" style={{ color: "var(--amber, #E8893A)" }} />}
            title="Explore as a Student"
            subtitle="Profile, community, mentorship"
          />
        </form>

        <form action={loginSchool} className="w-full">
          <DemoSubmitButton
            icon={<School className="w-8 h-8 flex-shrink-0" />}
            title="Explore as a School Admin"
            subtitle="Roster, mentorship, community, fundraising"
            variant="primary"
          />
        </form>
      </div>
    </div>
  );
}
