export type InviteEmailArgs = {
  to: string;
  name?: string;
  activateUrl: string;
};

/**
 * Stub — logs the invite instead of sending it. A later agent wires this
 * up to Resend (see lib/welcome-email.ts for the exact pattern: build the
 * HTML, call getResendClient().emails.send(...), throw on result.error).
 * Never throws: account creation must not fail because email isn't wired up.
 */
// TODO(email-integration): wire real Resend send here, see lib/welcome-email.ts for the pattern
export async function sendInviteEmail(
  args: InviteEmailArgs
): Promise<{ id: string | null }> {
  console.log(
    `[sendInviteEmail:stub] would invite ${args.name ?? args.to} <${args.to}> → ${args.activateUrl}`
  );
  return { id: null };
}
