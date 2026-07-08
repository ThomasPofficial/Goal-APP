export function surveyEmailHtml(schoolName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f5f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5ea;">
          <tr>
            <td style="background:#1a1a1f;padding:28px 32px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#9090a8;font-family:'Courier New',monospace;">Nivarro × ${schoolName}</p>
              <h1 style="margin:8px 0 0;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">Annual Outcomes Update</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#2a2a33;line-height:1.6;">
                Hey — it's that time of year. ${schoolName} uses Nivarro to show prospective students
                the real outcomes of graduates like you: where they went to college, what roles they landed,
                and what they've built since.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#2a2a33;line-height:1.6;">
                Takes two minutes. No test scores, no rankings — just your story.
              </p>
              <a href="https://app.nivarro.co/profile/survey"
                 style="display:inline-block;padding:12px 24px;background:#f59e0b;color:#1a1a1f;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.01em;">
                Update Your Outcomes →
              </a>
              <p style="margin:24px 0 0;font-size:12px;color:#9090a8;line-height:1.5;">
                You're receiving this because you're connected to ${schoolName} on Nivarro.
                Your information is only shared with your school's administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f0f0f5;background:#f9f9fb;">
              <p style="margin:0;font-size:11px;color:#b0b0c0;">
                Powered by <a href="https://app.nivarro.co" style="color:#4a80f0;text-decoration:none;">Nivarro</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
