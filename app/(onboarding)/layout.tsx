import { serverSignOut } from "@/lib/auth-actions";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <form action={serverSignOut} style={{ position: "fixed", top: 16, right: 16, zIndex: 50 }}>
        <button
          type="submit"
          className="text-xs"
          style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          Sign out
        </button>
      </form>
      {children}
    </div>
  );
}
