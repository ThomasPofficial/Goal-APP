"use client";

import { useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup, type RSMGeography } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

interface Destination {
  college: string;
  lat: number;
  lng: number;
  students: string[];
}

interface Props {
  destinations: Destination[];
}

export default function DestinationsMap({ destinations }: Props) {
  const [tooltip, setTooltip] = useState<{ college: string; students: string[]; x: number; y: number } | null>(null);

  return (
    <div style={{ position: "relative", width: "100%", background: "var(--n-bg2)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
      <ComposableMap
        projection="geoAlbersUsa"
        style={{ width: "100%", height: 480 }}
      >
        <ZoomableGroup zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: RSMGeography[] }) =>
              geographies.map((geo: RSMGeography) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: { fill: "var(--n-bg3, #1e1e2e)", stroke: "var(--border, #2a2a3e)", strokeWidth: 0.5, outline: "none" },
                    hover:   { fill: "var(--n-bg3, #1e1e2e)", stroke: "var(--blue, #4a80f0)", strokeWidth: 0.8, outline: "none" },
                    pressed: { fill: "var(--n-bg3, #1e1e2e)", outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {destinations.map((d) => (
            <Marker
              key={d.college}
              coordinates={[d.lng, d.lat]}
              onMouseEnter={(e) => {
                const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
                const svgPoint = (e as unknown as { clientX: number; clientY: number });
                setTooltip({
                  college: d.college,
                  students: d.students,
                  x: svgPoint.clientX - (rect?.left ?? 0),
                  y: svgPoint.clientY - (rect?.top ?? 0),
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <circle
                r={d.students.length > 1 ? 7 : 5}
                fill="var(--blue, #4a80f0)"
                fillOpacity={0.85}
                stroke="#fff"
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
              />
              {d.students.length > 1 && (
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  style={{ fontSize: 9, fill: "#fff", fontWeight: 700, pointerEvents: "none", userSelect: "none" }}
                >
                  {d.students.length}
                </text>
              )}
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: "var(--n-bg2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 12px",
            pointerEvents: "none",
            zIndex: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            minWidth: 160,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{tooltip.college}</p>
          {tooltip.students.map((s) => (
            <p key={s} style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text2)" }}>{s}</p>
          ))}
        </div>
      )}
    </div>
  );
}
