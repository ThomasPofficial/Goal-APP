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
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em] mb-8"
            style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}
          >
            Nivarro
          </p>

          <h2
            className="text-3xl font-semibold mb-6 leading-snug"
            style={{ color: "var(--text)", fontFamily: "var(--font-serif)" }}
          >
            Bridging the gap between potential and proof.
          </h2>

          <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--text2)" }}>
            <p>
              We connect young people — high schoolers, college students, the ones who are ready but
              can&apos;t get a foot in the door — to real opportunities in business and tech.
            </p>
            <p>
              Here&apos;s the problem: every company wants experience, every job posting wants AI
              skills, but nobody is telling you how to get there when you&apos;re just starting out.
              That&apos;s the wall. You&apos;re qualified enough to want it, not yet experienced
              enough to get it, and nobody is bridging that gap for you.
            </p>
            <p>
              Nivarro bridges it. The internships that put a real company name on your resume. The
              programs that teach you how to actually work with AI tools on the job. Quick, focused
              side quests — a few weeks, real experience, real results. The experiences that turn
              potential into proof.
            </p>
            <p>
              When we do that, something bigger happens. Gen Z finds their people. They discover
              what they are actually built for. They go home at the end of the day feeling like
              their work meant something.
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 w-full lg:w-[480px] lg:flex-shrink-0 relative z-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
