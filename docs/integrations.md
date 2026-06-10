# Integrations

Server-side wiring for PostHog, Resend, Notion, GitHub, and Google Forms.
Goal is one durable shape: external thing -> small webhook on Goal-APP ->
fan out to event store + side effects. No agent in the hot path.

## Required env vars

Set on Render service `Goal-APP-3` (`srv-d7o25h68bjmc7395irug`).

| Var                     | Purpose                                          | Required for           |
| ----------------------- | ------------------------------------------------ | ---------------------- |
| `RESEND_API_KEY`        | Existing — used by feedback + welcome email      | All email              |
| `FROM_EMAIL`            | Verified sender (e.g. `noreply@nivarro.co`)      | All email              |
| `AUTH_URL`              | Existing — used in welcome CTA link              | Welcome email          |
| `POSTHOG_PROJECT_KEY`   | Server-side capture key (project `phc_...`)      | Event capture          |
| `NEXT_PUBLIC_POSTHOG_KEY` | Existing client key, also fallback for server  | Event capture          |
| `NEXT_PUBLIC_POSTHOG_HOST` | Existing — `https://us.i.posthog.com`         | Event capture          |
| `NOTION_TOKEN`          | Internal integration secret                      | Notion writes          |
| `NOTION_SIGNUPS_DB_ID`  | DB id for signup rows                            | Notion writes (signup) |
| `GITHUB_PAT`            | Repo-scoped PAT for issue creation               | GitHub writes          |
| `GITHUB_WEBHOOK_SECRET` | Shared secret for `X-Hub-Signature-256`          | GitHub inbound webhook |
| `FORM_WEBHOOK_SECRET`   | Shared secret with Apps Script                   | Form inbound webhook   |

## PostHog (server-side capture)

Client analytics already in place via `components/providers/PostHogProvider`.
Server uses `lib/posthog-server.ts`:

```ts
import { capture } from "@/lib/posthog-server";

await capture({
  distinctId: user.email,
  event: "user_signed_up",
  properties: { source: "google_form" },
});
```

Capture is best-effort and never throws.

Useful product events to fire from server:

- `user_signed_up`
- `welcome_email_sent`
- `form_submitted`
- `org_application_created`
- `deploy_completed` (from GitHub release webhook)

## Welcome emails

`lib/welcome-email.ts` sends through Resend using the existing
`getResendClient()` helper. Triggered by the form-submit webhook when
`source === "signup-form"`. Cost: ~$0 at current volume (Resend free tier
covers 3k emails/month).

## Google Forms -> webhook

Apps Script attached to your form. Replace `SECRET` and the URL.

```js
function onFormSubmit(e) {
  const ans = e.namedValues || {};
  const get = (k) => (ans[k] && ans[k][0] ? ans[k][0] : undefined);
  const payload = {
    timestamp: new Date().toISOString(),
    formId: e.source.getId(),
    source: "signup-form",
    email: get("Email"),
    name: get("Name") || get("Full name"),
    answers: ans,
  };
  UrlFetchApp.fetch("https://nivarro.co/api/webhooks/form-submit", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: {
      "X-Form-Secret":
        PropertiesService.getScriptProperties().getProperty("FORM_WEBHOOK_SECRET"),
    },
    muteHttpExceptions: true,
  });
}
```

In Apps Script: Triggers -> add trigger -> `onFormSubmit` on form submit.
Set the secret in Project Settings -> Script Properties.

## Notion

`lib/notion.ts` exposes `createNotionPage` and helpers under `N`.

Schema expectations for the signups DB (`NOTION_SIGNUPS_DB_ID`):

- `Name` (Title)
- `Email` (Email)
- `Source` (Rich text)
- `FormId` (Rich text)
- `SubmittedAt` (Date)

Share the database with the integration in the Notion UI or writes 404.

## GitHub

- Outbound: `createIssue({ owner, repo, title, body, labels })` from
  `lib/github.ts`. Useful for turning bug-report form submissions into
  tracked issues.
- Inbound: `POST /api/webhooks/github` validates `X-Hub-Signature-256` and
  forwards `release` + `main` push events to PostHog as deploy markers.

Register the webhook on the repo:

- Payload URL: `https://nivarro.co/api/webhooks/github`
- Content type: `application/json`
- Secret: value of `GITHUB_WEBHOOK_SECRET`
- Events: just `Pushes` and `Releases`

## Cost discipline

Welcome emails, form intake, Notion writes, GitHub issue creation, and
PostHog ingestion all run as plain server code. No agent turns, no cron
loops. Budget impact: ~$0/day for these flows themselves.

If we add a daily summary later, route it through `cron` with
`lightContext: true`, deliver to webchat (verified), and cap tokens. See
`MEMORY.md` for the 2026-06-03 incident notes.
