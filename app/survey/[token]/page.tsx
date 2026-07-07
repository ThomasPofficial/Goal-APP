import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { SurveyPrefill } from "@/lib/survey-prefill";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ success?: string; already?: string; error?: string }>;
};

export default async function SurveyPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { success, already, error } = await searchParams;
  const appUrl = process.env.AUTH_URL ?? "https://app.nivarro.co";

  const st = await prisma.surveyToken.findUnique({
    where: { token },
    include: {
      user: { select: { name: true, profile: { select: { displayName: true } } } },
    },
  });
  if (!st) return notFound();

  const name = st.user.profile?.displayName ?? st.user.name ?? "there";
  const prefill: SurveyPrefill | null = st.prefillData
    ? (JSON.parse(st.prefillData) as SurveyPrefill)
    : null;
  const expired   = st.expiresAt < new Date();
  const responded = !!st.respondedAt;

  if (success)   return <SuccessPage name={name} />;
  if (already)   return <AlreadyPage />;
  if (expired)   return <ExpiredPage />;
  if (responded) return <AlreadyPage />;

  return (
    <SurveyForm
      token={token}
      prefill={prefill}
      name={name}
      appUrl={appUrl}
      errorMsg={error ? "Something went wrong — please try again." : null}
    />
  );
}

function SurveyForm({
  token, prefill, name, appUrl, errorMsg,
}: {
  token: string;
  prefill: SurveyPrefill | null;
  name: string;
  appUrl: string;
  errorMsg: string | null;
}) {
  return (
    <div style={{ maxWidth: 560, margin: "48px auto", padding: "0 24px", fontFamily: "sans-serif", color: "#1a1a1f" }}>
      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", margin: "0 0 8px" }}>
        Annual Check-in
      </p>
      <h1 style={{ fontSize: 32, letterSpacing: "-0.02em", margin: "0 0 8px", fontWeight: 800 }}>
        Hi {name}
      </h1>
      <p style={{ fontSize: 14, color: "#58586a", margin: "0 0 32px" }}>
        Update your info below — takes about 2 minutes.
      </p>
      {errorMsg && (
        <p style={{ background: "#fff0f0", border: "1px solid #fca5a5", padding: "10px 14px", fontSize: 13, marginBottom: 20 }}>
          {errorMsg}
        </p>
      )}
      <form method="POST" action={`${appUrl}/api/survey/${token}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="College / University"   name="confirmedCollege" defaultValue={prefill?.college  ?? ""} placeholder="MIT, State University…" />
        <Field label="Major / Field of Study" name="confirmedMajor"   defaultValue={prefill?.major    ?? ""} placeholder="Computer Science…" />
        <Field label="Industry"               name="industry"         defaultValue={prefill?.industry ?? ""} placeholder="Software, Healthcare, Finance…" />
        <Field label="Current Employer"       name="employer"         defaultValue={prefill?.employer ?? ""} placeholder="Company name" />
        <Field label="Job Title"              name="jobTitle"         defaultValue={prefill?.jobTitle ?? ""} placeholder="Software Engineer…" />
        <Field label="LinkedIn URL"           name="linkedinUrl"      defaultValue=""                        placeholder="https://linkedin.com/in/yourname" />
        <button
          type="submit"
          style={{ marginTop: 8, background: "#c9a84c", color: "#fff", fontWeight: 600, border: "none", padding: "14px 24px", cursor: "pointer", fontSize: 14, alignSelf: "flex-start" }}
        >
          Submit update
        </button>
      </form>
      <p style={{ marginTop: 40, fontSize: 12, color: "#909098" }}>
        <a href={`${appUrl}/api/survey/${token}/optout`} style={{ color: "inherit" }}>
          Unsubscribe from annual surveys
        </a>
      </p>
    </div>
  );
}

function Field({ label, name, defaultValue, placeholder }: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e5e5e5", padding: "10px 12px", fontSize: 14, outline: "none", background: "#fafafa" }}
      />
    </div>
  );
}

function SuccessPage({ name }: { name: string }) {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", margin: "0 0 12px" }}>
        Updated
      </p>
      <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Thanks, {name}.</h1>
      <p style={{ color: "#58586a", fontSize: 14 }}>Your update is saved. See you next May.</p>
    </div>
  );
}

function AlreadyPage() {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", margin: "0 0 12px" }}>
        Already done
      </p>
      <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Your response is on file.</h1>
      <p style={{ color: "#58586a", fontSize: 14 }}>You already submitted for this year. See you next May.</p>
    </div>
  );
}

function ExpiredPage() {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f87171", margin: "0 0 12px" }}>
        Expired
      </p>
      <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>This link has expired.</h1>
      <p style={{ color: "#58586a", fontSize: 14 }}>
        Survey links are valid for 60 days. Contact your school counselor for a new link.
      </p>
    </div>
  );
}
