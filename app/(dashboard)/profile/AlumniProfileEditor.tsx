"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Toggle from "@/components/ui/Toggle";

interface Props {
  initialProfile: {
    linkedinUrl: string;
    employer: string;
    jobTitle: string;
    confirmedCollege: string;
    confirmedMajor: string;
    isAvailableToMentor: boolean;
  };
}

export default function AlumniProfileEditor({ initialProfile }: Props) {
  const router = useRouter();
  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile.linkedinUrl);
  const [employer, setEmployer] = useState(initialProfile.employer);
  const [jobTitle, setJobTitle] = useState(initialProfile.jobTitle);
  const [confirmedCollege, setConfirmedCollege] = useState(initialProfile.confirmedCollege);
  const [confirmedMajor, setConfirmedMajor] = useState(initialProfile.confirmedMajor);
  const [isAvailableToMentor, setIsAvailableToMentor] = useState(initialProfile.isAvailableToMentor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedinUrl, employer, jobTitle, confirmedCollege, confirmedMajor, isAvailableToMentor }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save profile.");
    } else {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#eaeaea]">Alumni Profile</h1>
        <p className="text-sm text-[#909098] mt-1">
          Keep your destination info current so your school can track outcomes, and open yourself up for mentorship.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
            Destination
          </h2>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              LinkedIn URL
            </label>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Employer
            </label>
            <input
              value={employer}
              onChange={(e) => setEmployer(e.target.value)}
              placeholder="Company name"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Job Title
            </label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Your role"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Confirmed College
            </label>
            <input
              value={confirmedCollege}
              onChange={(e) => setConfirmedCollege(e.target.value)}
              placeholder="Where you ended up"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Confirmed Major
            </label>
            <input
              value={confirmedMajor}
              onChange={(e) => setConfirmedMajor(e.target.value)}
              placeholder="What you studied"
              className="w-full"
            />
          </div>
        </div>

        <div
          className="p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text2)" }}>
            Mentorship
          </h2>
          <Toggle
            checked={isAvailableToMentor}
            onChange={setIsAvailableToMentor}
            label="Available to mentor"
            description="Open to being paired as a mentor to current students"
          />
        </div>

        {error && (
          <p className="text-sm text-[#f87171] bg-[#f8717115] border border-[#f8717130] rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-[#4a80f0] hover:bg-[#6a9fff] text-[#080809] font-semibold text-sm rounded-md px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Saving..." : saved ? "Saved!" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
