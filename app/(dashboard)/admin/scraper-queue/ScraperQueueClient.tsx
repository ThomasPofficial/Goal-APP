"use client";

import { useState } from "react";

interface Listing {
  id: string;
  sourceInstitution: string;
  title: string;
  sourceUrl: string;
  aiConfidence: number | null;
  aiSummary: string | null;
  status: string;
  scrapedAt: string;
}

export default function ScraperQueueClient({ listings }: { listings: Listing[] }) {
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(listings.map((l) => [l.id, l.status]))
  );

  const act = async (id: string, action: "approve" | "reject") => {
    await fetch(`/api/admin/scraper/${id}/${action}`, { method: "POST" });
    setStatuses((prev) => ({ ...prev, [id]: action === "approve" ? "APPROVED" : "REJECTED" }));
  };

  const runScraper = async () => {
    const res = await fetch("/api/admin/scraper/run");
    const data = await res.json();
    alert(`Done. Found: ${data.found ?? 0} new listings.`);
    window.location.reload();
  };

  const pending = listings.filter((l) => statuses[l.id] === "PENDING");
  const reviewed = listings.filter((l) => statuses[l.id] !== "PENDING");

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>Scraper Queue</h1>
          <p className="text-sm mt-1 font-mono" style={{ color: "var(--muted)" }}>
            {pending.length} PENDING · {reviewed.length} REVIEWED
          </p>
        </div>
        <button onClick={runScraper} className="btn-primary text-sm px-4 py-2">
          Run Scraper Now
        </button>
      </div>

      {listings.length === 0 && (
        <p className="text-sm text-center py-16" style={{ color: "var(--muted)" }}>
          No scraped listings yet. Run the scraper to populate the queue.
        </p>
      )}

      {pending.length > 0 && (
        <section>
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
            PENDING REVIEW
          </p>
          <div className="space-y-3">
            {pending.map((l) => (
              <ListingRow key={l.id} listing={l} status={statuses[l.id]} onAct={act} />
            ))}
          </div>
        </section>
      )}

      {reviewed.length > 0 && (
        <section>
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
            REVIEWED
          </p>
          <div className="space-y-3">
            {reviewed.map((l) => (
              <ListingRow key={l.id} listing={l} status={statuses[l.id]} onAct={act} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ListingRow({
  listing,
  status,
  onAct,
}: {
  listing: Listing;
  status: string;
  onAct: (id: string, action: "approve" | "reject") => void;
}) {
  return (
    <div
      className="p-4 border flex items-start justify-between gap-4"
      style={{ background: "var(--surface)", borderColor: "var(--border-md)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-xs font-mono uppercase tracking-widest px-2 py-0.5 ${
              status === "PENDING"
                ? "text-amber-400"
                : status === "APPROVED"
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            {status}
          </span>
          {listing.aiConfidence != null && (
            <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
              AI: {(listing.aiConfidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{listing.title}</p>
        <p className="text-xs" style={{ color: "var(--text2)" }}>{listing.sourceInstitution}</p>
        {listing.aiSummary && (
          <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>{listing.aiSummary}</p>
        )}
        <a
          href={listing.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs mt-1 inline-block hover:underline"
          style={{ color: "var(--blue)" }}
        >
          {listing.sourceUrl}
        </a>
      </div>
      {status === "PENDING" && (
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onAct(listing.id, "approve")} className="btn-primary text-xs px-3 py-1.5">
            Approve
          </button>
          <button onClick={() => onAct(listing.id, "reject")} className="btn-ghost text-xs px-3 py-1.5">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
