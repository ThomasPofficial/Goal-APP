export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(74,128,240,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(74,128,240,0.04) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      {/* Mission panel — hidden on small screens */}
      <div
        className="hidden lg:flex flex-col justify-center px-16 flex-1 relative overflow-hidden"
        style={{ borderRight: "1px solid var(--border)" }}
      >
        {/* Ops-room photo — grayscale circular hero, faded into the background */}
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            right: -70,
            top: "50%",
            transform: "translateY(-50%)",
            width: 380,
            height: 380,
            borderRadius: "50%",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            zIndex: 0,
            opacity: 0.9,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ops-room.png"
            alt=""
            style={{
              width: "140%",
              height: "140%",
              objectFit: "cover",
              objectPosition: "60% 30%",
              margin: "-20% -20%",
              filter: "grayscale(1) contrast(2) brightness(1.1)",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: "radial-gradient(circle, transparent 45%, var(--bg) 100%)" }}
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            right: -22,
            top: "50%",
            transform: "translateY(-50%)",
            width: 428,
            height: 428,
            borderRadius: "50%",
            border: "1px dashed rgba(74,128,240,0.3)",
            zIndex: 0,
          }}
        />

        <div className="max-w-md relative z-10">
          <div
            className="inline-flex items-center gap-2 mb-4"
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-full)",
              background: "var(--surface2)",
              border: "1px solid var(--border-md)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
                flexShrink: 0,
                boxShadow: "0 0 8px var(--accent)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--accent-hover)",
              }}
            >
              Private school fundraising, automated
            </span>
          </div>

          <h1 className="mb-4 flex flex-wrap items-baseline gap-x-3">
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 800,
                fontSize: "clamp(34px, 4.6vw, 48px)",
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                color: "var(--text)",
              }}
            >
              Potential,
            </span>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontStyle: "italic",
                fontSize: "clamp(30px, 4vw, 42px)",
                color: "var(--text2)",
              }}
            >
              made
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                fontSize: "clamp(46px, 6.4vw, 68px)",
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                color: "var(--accent)",
                lineHeight: 0.9,
              }}
            >
              proof.
            </span>
          </h1>

          <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text2)", maxWidth: 420 }}>
            We connect students with school alumni and give them the tools to complete
            high-quality, real-world projects to level up their resumes. Furthermore, we help
            schools secure funds from these alumni for school improvement and community
            strengthening. We then document where these students go to college and where they
            obtain jobs, so schools can advertise their programs&apos; effectiveness.
          </p>

          <a href="mailto:team.nivarro@gmail.com" className="btn-primary">
            Request a briefing
          </a>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 w-full lg:w-[480px] lg:flex-shrink-0 relative z-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
