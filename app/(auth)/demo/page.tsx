import Link from "next/link";
import { GraduationCap, School } from "lucide-react";

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

      <div className="space-y-3">
        <Link
          href="/demo/student"
          className="w-full flex items-center gap-3 text-sm py-3 px-4"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: 6 }}
        >
          <GraduationCap className="w-5 h-5" style={{ color: "var(--amber, #E8893A)" }} />
          <span>
            <span className="block font-semibold">Explore as a Student</span>
            <span className="block text-xs" style={{ color: "var(--muted)" }}>Profile, community, mentorship</span>
          </span>
        </Link>

        <Link
          href="/demo/school"
          className="w-full flex items-center gap-3 text-sm py-3 px-4"
          style={{ background: "var(--amber, #E8893A)", color: "#000", borderRadius: 6, fontWeight: 600, boxShadow: "0 4px 20px rgba(232,137,58,0.35)" }}
        >
          <School className="w-5 h-5" />
          <span>
            <span className="block font-semibold">Explore as a School Admin</span>
            <span className="block text-xs" style={{ opacity: 0.75 }}>Roster, brochure, communities, campaigns</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
