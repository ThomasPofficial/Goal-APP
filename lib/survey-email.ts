import { getResendClient } from "./resend";
import type { SurveyPrefill } from "./survey-prefill";

export type SurveyEmailArgs = {
  to: string;
  name: string;
  token: string;
  prefill: SurveyPrefill | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasPrefill(p: SurveyPrefill | null): p is SurveyPrefill {
  return !!(p && (p.college || p.employer || p.jobTitle));
}

export async function sendSurveyEmail(args: SurveyEmailArgs): Promise<void> {
  const from   = process.env.FROM_EMAIL ?? "noreply@nivarro.co";
  const appUrl = process.env.AUTH_URL   ?? "https://app.nivarro.co";
  const surveyUrl = `${appUrl}/survey/${args.token}`;
  const optoutUrl = `${appUrl}/api/survey/${args.token}/optout`;
  const greet = esc(args.name.trim() || "there");

  const subject = hasPrefill(args.prefill)
    ? "Your annual Nivarro update — confirm in one click"
    : "Your annual Nivarro update — 2 minutes";

  const html = hasPrefill(args.prefill)
    ? prefillHtml({ greet, appUrl, token: args.token, surveyUrl, optoutUrl, prefill: args.prefill })
    : blankHtml({ greet, surveyUrl, optoutUrl });

  const result = await getResendClient().emails.send({ from, to: args.to, subject, html });
  if (result.error) throw new Error(`Survey email failed: ${result.error.message}`);
}

function prefillHtml(a: {
  greet: string;
  appUrl: string;
  token: string;
  surveyUrl: string;
  optoutUrl: string;
  prefill: SurveyPrefill;
}): string {
  const rows = [
    a.prefill.college  && `<tr><td style="color:#909098;font-size:13px;padding:4px 0">College</td><td style="font-size:13px;padding:4px 0 4px 16px;color:#1a1a1f">${esc(a.prefill.college)}</td></tr>`,
    a.prefill.major    && `<tr><td style="color:#909098;font-size:13px;padding:4px 0">Major</td><td style="font-size:13px;padding:4px 0 4px 16px;color:#1a1a1f">${esc(a.prefill.major!)}</td></tr>`,
    a.prefill.employer && `<tr><td style="color:#909098;font-size:13px;padding:4px 0">Employer</td><td style="font-size:13px;padding:4px 0 4px 16px;color:#1a1a1f">${esc(a.prefill.employer!)}</td></tr>`,
    a.prefill.jobTitle && `<tr><td style="color:#909098;font-size:13px;padding:4px 0">Job Title</td><td style="font-size:13px;padding:4px 0 4px 16px;color:#1a1a1f">${esc(a.prefill.jobTitle!)}</td></tr>`,
  ].filter(Boolean).join("");

  const hiddenInputs = [
    a.prefill.college  && `<input type="hidden" name="confirmedCollege" value="${esc(a.prefill.college)}" />`,
    a.prefill.major    && `<input type="hidden" name="confirmedMajor"   value="${esc(a.prefill.major!)}" />`,
    a.prefill.industry && `<input type="hidden" name="industry"         value="${esc(a.prefill.industry!)}" />`,
    a.prefill.employer && `<input type="hidden" name="employer"         value="${esc(a.prefill.employer!)}" />`,
    a.prefill.jobTitle && `<input type="hidden" name="jobTitle"         value="${esc(a.prefill.jobTitle!)}" />`,
  ].filter(Boolean).join("\n    ");

  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1f">
  <h2 style="margin:0 0 8px;font-size:20px">Hi ${a.greet},</h2>
  <p style="color:#58586a;line-height:1.55;margin:0 0 20px;font-size:14px">Time for your annual Nivarro check-in. Here's what your LinkedIn shows:</p>
  <table style="border-collapse:collapse;margin-bottom:24px">${rows}</table>
  <p style="color:#58586a;font-size:13px;margin:0 0 20px">Is this still accurate?</p>
  <form method="POST" action="${a.appUrl}/api/survey/${esc(a.token)}" style="display:inline;margin-right:12px">
    ${hiddenInputs}
    <button type="submit" style="background:#c9a84c;color:#fff;font-weight:600;border:none;padding:12px 20px;cursor:pointer;font-size:14px">Confirm — looks right</button>
  </form>
  <a href="${a.surveyUrl}" style="display:inline-block;background:#1a1a1f;color:#fff;font-weight:600;text-decoration:none;padding:12px 20px;font-size:14px">Update my info →</a>
  <p style="color:#909098;font-size:12px;margin:32px 0 0"><a href="${a.optoutUrl}" style="color:#909098">Unsubscribe from annual surveys</a></p>
</div>`;
}

function blankHtml(a: { greet: string; surveyUrl: string; optoutUrl: string }): string {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1f">
  <h2 style="margin:0 0 8px;font-size:20px">Hi ${a.greet},</h2>
  <p style="color:#58586a;line-height:1.55;margin:0 0 24px;font-size:14px">Time for your annual Nivarro check-in. Where are you now?</p>
  <a href="${a.surveyUrl}" style="display:inline-block;background:#c9a84c;color:#fff;font-weight:600;text-decoration:none;padding:12px 24px;font-size:14px">Complete your update →</a>
  <p style="color:#909098;font-size:12px;margin:32px 0 0"><a href="${a.optoutUrl}" style="color:#909098">Unsubscribe from annual surveys</a></p>
</div>`;
}
