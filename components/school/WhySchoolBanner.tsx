"use client";
import Link from "next/link";
import { ArrowRight, ClipboardList, ExternalLink } from "lucide-react";

interface Props {
  schoolName: string;
  studentsCount: number;
  collegesCount: number;
  jobsCount: number;
}

export default function WhySchoolBanner({ schoolName, studentsCount, collegesCount, jobsCount }: Props) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--amber)",
      padding: "20px 24px",
      marginBottom: 28,
    }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 6px" }}>
        Your School
      </p>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 2.5vw, 26px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 12px" }}>
        Why {schoolName}?
      </h2>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { value: studentsCount, label: "Students on Nivarro" },
          { value: collegesCount, label: "Colleges represented" },
          { value: jobsCount,     label: "Jobs & internships secured" },
        ].map(({ value, label }) => (
          <div key={label}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--amber)", letterSpacing: "-0.04em" }}>{value}</span>
            <span style={{ fontSize: 12, color: "var(--n-text2)", marginLeft: 6 }}>{label}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: "var(--n-text2)", margin: "0 0 16px" }}>
        Help build this picture for prospective students — update your outcomes and keep your LinkedIn current.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/profile/survey" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 16px", fontSize: 12, fontWeight: 600,
          background: "var(--amber)", color: "#1a1a1f",
          textDecoration: "none", borderRadius: 0,
        }}>
          <ClipboardList size={13} />
          Add Your Outcomes
          <ArrowRight size={13} />
        </Link>
        <Link href="/profile" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px", fontSize: 12, fontWeight: 600,
          background: "transparent", color: "var(--text)",
          border: "1px solid var(--border)", textDecoration: "none", borderRadius: 0,
        }}>
          <ExternalLink size={13} />
          Update LinkedIn
        </Link>
      </div>
    </div>
  );
}
