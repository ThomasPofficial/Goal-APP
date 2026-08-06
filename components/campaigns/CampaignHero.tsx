"use client";

import { useState } from "react";
import CampaignCanvas, { type ImageParams } from "./CampaignCanvas";

interface Props {
  imageParams: ImageParams;
  headline: string;
  subheadline: string;
  editable?: boolean;
  onHeadlineChange?: (value: string) => void;
  onSubheadlineChange?: (value: string) => void;
}

export default function CampaignHero({
  imageParams,
  headline,
  subheadline,
  editable = false,
  onHeadlineChange,
  onSubheadlineChange,
}: Props) {
  const [editingHeadline, setEditingHeadline] = useState(false);
  const [editingSubheadline, setEditingSubheadline] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <CampaignCanvas imageParams={imageParams} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "32px 40px",
        }}
      >
        {editable && editingHeadline ? (
          <textarea
            autoFocus
            value={headline}
            onChange={(e) => onHeadlineChange?.(e.target.value)}
            onBlur={() => setEditingHeadline(false)}
            rows={2}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(24px, 3vw, 44px)",
              letterSpacing: "-0.02em",
              color: "#fff",
              background: "rgba(0,0,0,0.35)",
              border: "1px dashed rgba(255,255,255,0.5)",
              lineHeight: 1.15,
              margin: "0 0 12px",
              padding: 4,
              resize: "vertical",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <h2
            onClick={() => editable && setEditingHeadline(true)}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(24px, 3vw, 44px)",
              letterSpacing: "-0.02em",
              color: "#fff",
              margin: "0 0 12px",
              lineHeight: 1.15,
              cursor: editable ? "text" : "default",
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
            }}
          >
            {headline}
          </h2>
        )}

        {editable && editingSubheadline ? (
          <input
            autoFocus
            value={subheadline}
            onChange={(e) => onSubheadlineChange?.(e.target.value)}
            onBlur={() => setEditingSubheadline(false)}
            style={{
              fontSize: 18,
              color: "#e8893a",
              fontWeight: 600,
              background: "rgba(0,0,0,0.35)",
              border: "1px dashed rgba(255,255,255,0.5)",
              padding: 4,
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <p
            onClick={() => editable && setEditingSubheadline(true)}
            style={{
              fontSize: 18,
              color: "#e8893a",
              fontWeight: 600,
              margin: 0,
              cursor: editable ? "text" : "default",
              textShadow: "0 1px 8px rgba(0,0,0,0.6)",
            }}
          >
            {subheadline}
          </p>
        )}
      </div>
    </div>
  );
}
