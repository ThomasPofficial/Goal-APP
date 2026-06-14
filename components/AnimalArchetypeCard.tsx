"use client";

import type { ReactElement } from "react";
import { ANIMAL_ARCHETYPES, type AnimalKey } from "@/lib/animalArchetypes";

function GorillaSprite() {
  return (
    <svg width="64" height="80" viewBox="0 0 64 80" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      {/* Wide boxy head */}
      <rect x="8" y="2" width="48" height="42" fill="#3D2660" />
      {/* Heavy brow ridge */}
      <rect x="8" y="2" width="48" height="12" fill="#1A0A30" />
      {/* Brow overhang */}
      <rect x="6" y="10" width="52" height="4" fill="#1A0A30" />
      {/* Eye whites */}
      <rect x="14" y="16" width="12" height="12" fill="#E8E8F4" />
      <rect x="38" y="16" width="12" height="12" fill="#E8E8F4" />
      {/* Pupils */}
      <rect x="17" y="19" width="6" height="6" fill="#0A0A14" />
      <rect x="41" y="19" width="6" height="6" fill="#0A0A14" />
      {/* Pupil shine */}
      <rect x="18" y="20" width="2" height="2" fill="#E8E8F4" />
      <rect x="42" y="20" width="2" height="2" fill="#E8E8F4" />
      {/* Nose */}
      <rect x="22" y="28" width="20" height="10" fill="#1A0A30" />
      <rect x="24" y="30" width="6" height="6" fill="#0A0A14" />
      <rect x="34" y="30" width="6" height="6" fill="#0A0A14" />
      {/* Mouth */}
      <rect x="16" y="38" width="32" height="6" fill="#1A0A30" />
      {/* Body - barrel chest */}
      <rect x="4" y="44" width="56" height="26" fill="#2A1648" />
      {/* Arms hanging low */}
      <rect x="0" y="46" width="8" height="26" fill="#3D2660" />
      <rect x="56" y="46" width="8" height="26" fill="#3D2660" />
      {/* Knuckles */}
      <rect x="0" y="68" width="12" height="8" fill="#1A0A30" />
      <rect x="52" y="68" width="12" height="8" fill="#1A0A30" />
    </svg>
  );
}

function TigerSprite() {
  return (
    <svg width="64" height="80" viewBox="0 0 64 80" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      {/* Ears */}
      <rect x="8" y="0" width="14" height="12" fill="#D4721C" />
      <rect x="42" y="0" width="14" height="12" fill="#D4721C" />
      <rect x="10" y="2" width="8" height="8" fill="#C85A14" />
      <rect x="46" y="2" width="8" height="8" fill="#C85A14" />
      {/* Head */}
      <rect x="8" y="6" width="48" height="40" fill="#D4721C" />
      {/* Forehead stripes */}
      <rect x="14" y="6" width="5" height="12" fill="#1A0A08" />
      <rect x="28" y="4" width="5" height="16" fill="#1A0A08" />
      <rect x="45" y="6" width="5" height="12" fill="#1A0A08" />
      {/* Eye whites */}
      <rect x="14" y="22" width="12" height="10" fill="#E8E8F4" />
      <rect x="38" y="22" width="12" height="10" fill="#E8E8F4" />
      {/* Green eyes */}
      <rect x="17" y="24" width="6" height="6" fill="#20A040" />
      <rect x="41" y="24" width="6" height="6" fill="#20A040" />
      <rect x="18" y="25" width="2" height="2" fill="#E8E8F4" />
      <rect x="42" y="25" width="2" height="2" fill="#E8E8F4" />
      {/* Cheek stripes */}
      <rect x="8" y="30" width="8" height="4" fill="#1A0A08" />
      <rect x="48" y="30" width="8" height="4" fill="#1A0A08" />
      <rect x="8" y="36" width="8" height="4" fill="#1A0A08" />
      <rect x="48" y="36" width="8" height="4" fill="#1A0A08" />
      {/* Nose */}
      <rect x="26" y="32" width="12" height="8" fill="#C85A14" />
      <rect x="28" y="34" width="8" height="4" fill="#1A0A08" />
      {/* Mouth */}
      <rect x="20" y="40" width="24" height="6" fill="#1A0A08" />
      {/* Body with stripes */}
      <rect x="8" y="46" width="48" height="26" fill="#D4721C" />
      <rect x="16" y="48" width="5" height="18" fill="#1A0A08" />
      <rect x="30" y="50" width="5" height="16" fill="#1A0A08" />
      <rect x="44" y="48" width="5" height="18" fill="#1A0A08" />
      {/* Legs */}
      <rect x="12" y="68" width="16" height="8" fill="#C85A14" />
      <rect x="36" y="68" width="16" height="8" fill="#C85A14" />
    </svg>
  );
}

function CheetahSprite() {
  return (
    <svg width="64" height="80" viewBox="0 0 64 80" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      {/* Ears - rounder than tiger */}
      <rect x="10" y="0" width="12" height="10" fill="#C8A020" />
      <rect x="42" y="0" width="12" height="10" fill="#C8A020" />
      {/* Head - slightly narrower/sleeker */}
      <rect x="10" y="4" width="44" height="38" fill="#C8A020" />
      {/* Forehead spots */}
      <rect x="20" y="6" width="5" height="5" fill="#2A1808" />
      <rect x="34" y="4" width="5" height="5" fill="#2A1808" />
      <rect x="46" y="6" width="5" height="5" fill="#2A1808" />
      {/* Eyes - amber/fast */}
      <rect x="14" y="18" width="12" height="10" fill="#E8E8F4" />
      <rect x="38" y="18" width="12" height="10" fill="#E8E8F4" />
      <rect x="17" y="20" width="6" height="6" fill="#E8A020" />
      <rect x="41" y="20" width="6" height="6" fill="#E8A020" />
      <rect x="18" y="21" width="2" height="2" fill="#E8E8F4" />
      <rect x="42" y="21" width="2" height="2" fill="#E8E8F4" />
      {/* Tear marks - cheetah's defining face feature */}
      <rect x="13" y="28" width="3" height="12" fill="#2A1808" />
      <rect x="48" y="28" width="3" height="12" fill="#2A1808" />
      {/* Cheek spots */}
      <rect x="8" y="22" width="5" height="5" fill="#2A1808" />
      <rect x="51" y="22" width="5" height="5" fill="#2A1808" />
      {/* Nose */}
      <rect x="27" y="28" width="10" height="7" fill="#A07018" />
      {/* Mouth */}
      <rect x="20" y="36" width="24" height="5" fill="#2A1808" />
      {/* Lean body */}
      <rect x="12" y="42" width="40" height="26" fill="#C8A020" />
      {/* Body spots */}
      <rect x="16" y="46" width="6" height="6" fill="#2A1808" />
      <rect x="30" y="44" width="6" height="6" fill="#2A1808" />
      <rect x="42" y="48" width="6" height="6" fill="#2A1808" />
      <rect x="22" y="56" width="6" height="6" fill="#2A1808" />
      <rect x="38" y="58" width="6" height="6" fill="#2A1808" />
      {/* Legs */}
      <rect x="14" y="64" width="14" height="12" fill="#B89018" />
      <rect x="36" y="64" width="14" height="12" fill="#B89018" />
    </svg>
  );
}

function LionSprite() {
  return (
    <svg width="64" height="80" viewBox="0 0 64 80" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      {/* Mane - big outer ring */}
      <rect x="0" y="4" width="64" height="54" fill="#8B6030" />
      {/* Mane texture blocks */}
      <rect x="0" y="4" width="16" height="54" fill="#6B4A20" />
      <rect x="48" y="4" width="16" height="54" fill="#6B4A20" />
      <rect x="0" y="4" width="64" height="12" fill="#7A5528" />
      <rect x="0" y="46" width="64" height="12" fill="#7A5528" />
      {/* Inner face */}
      <rect x="16" y="14" width="32" height="34" fill="#D4A020" />
      {/* Mane wisps into face */}
      <rect x="16" y="14" width="6" height="34" fill="#8B6030" />
      <rect x="42" y="14" width="6" height="34" fill="#8B6030" />
      {/* Eyes - amber and royal */}
      <rect x="20" y="20" width="10" height="10" fill="#E8E8F4" />
      <rect x="34" y="20" width="10" height="10" fill="#E8E8F4" />
      <rect x="22" y="22" width="6" height="6" fill="#D4A020" />
      <rect x="36" y="22" width="6" height="6" fill="#D4A020" />
      <rect x="23" y="23" width="2" height="2" fill="#E8E8F4" />
      <rect x="37" y="23" width="2" height="2" fill="#E8E8F4" />
      {/* Nose */}
      <rect x="28" y="30" width="8" height="6" fill="#A07018" />
      {/* Proud mouth */}
      <rect x="22" y="38" width="20" height="5" fill="#8B5A14" />
      <rect x="22" y="38" width="8" height="5" fill="#E8D880" />
      <rect x="34" y="38" width="8" height="5" fill="#E8D880" />
      {/* Body below mane */}
      <rect x="10" y="58" width="44" height="18" fill="#D4A020" />
      {/* Legs */}
      <rect x="14" y="68" width="14" height="8" fill="#C89018" />
      <rect x="36" y="68" width="14" height="8" fill="#C89018" />
    </svg>
  );
}

function HyenaSprite() {
  return (
    <svg width="64" height="80" viewBox="0 0 64 80" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      {/* Mane ridge on top */}
      <rect x="22" y="0" width="20" height="8" fill="#5A3A10" />
      <rect x="18" y="2" width="28" height="6" fill="#4A2A08" />
      {/* Head - wedge (wider at back) */}
      <rect x="6" y="4" width="52" height="36" fill="#7A5A20" />
      {/* Eyes - manic orange */}
      <rect x="12" y="10" width="12" height="10" fill="#E8E8F4" />
      <rect x="40" y="10" width="12" height="10" fill="#E8E8F4" />
      <rect x="15" y="12" width="6" height="6" fill="#D47040" />
      <rect x="43" y="12" width="6" height="6" fill="#D47040" />
      <rect x="16" y="13" width="2" height="2" fill="#E8E8F4" />
      <rect x="44" y="13" width="2" height="2" fill="#E8E8F4" />
      {/* Spots on face */}
      <rect x="8" y="22" width="7" height="7" fill="#3A1A08" />
      <rect x="28" y="20" width="7" height="7" fill="#3A1A08" />
      <rect x="50" y="22" width="7" height="7" fill="#3A1A08" />
      {/* BIG grin - the defining feature */}
      <rect x="12" y="30" width="40" height="10" fill="#0A0A14" />
      {/* Teeth - wide and crooked */}
      <rect x="14" y="31" width="5" height="8" fill="#E8E8F4" />
      <rect x="21" y="31" width="5" height="8" fill="#E8E8F4" />
      <rect x="28" y="31" width="5" height="8" fill="#E8E8F4" />
      <rect x="35" y="31" width="5" height="8" fill="#E8E8F4" />
      <rect x="42" y="31" width="5" height="8" fill="#E8E8F4" />
      {/* Hunched body */}
      <rect x="4" y="40" width="56" height="26" fill="#6A4A18" />
      {/* Body spots */}
      <rect x="10" y="44" width="8" height="8" fill="#3A1A08" />
      <rect x="28" y="42" width="8" height="8" fill="#3A1A08" />
      <rect x="46" y="46" width="8" height="8" fill="#3A1A08" />
      <rect x="18" y="56" width="8" height="8" fill="#3A1A08" />
      {/* Legs */}
      <rect x="10" y="62" width="16" height="14" fill="#7A5A20" />
      <rect x="38" y="62" width="16" height="14" fill="#7A5A20" />
    </svg>
  );
}

function OwlSprite() {
  return (
    <svg width="64" height="80" viewBox="0 0 64 80" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      {/* Ear tufts */}
      <rect x="12" y="0" width="10" height="10" fill="#1A3A5C" />
      <rect x="42" y="0" width="10" height="10" fill="#1A3A5C" />
      <rect x="14" y="0" width="6" height="8" fill="#0A1E38" />
      <rect x="44" y="0" width="6" height="8" fill="#0A1E38" />
      {/* Round head */}
      <rect x="4" y="4" width="56" height="50" fill="#1A3A5C" />
      {/* Facial disc */}
      <rect x="4" y="8" width="10" height="36" fill="#0A1E38" />
      <rect x="50" y="8" width="10" height="36" fill="#0A1E38" />
      {/* ENORMOUS eyes - the whole face basically */}
      <rect x="6" y="10" width="22" height="24" fill="#E8E8F4" />
      <rect x="36" y="10" width="22" height="24" fill="#E8E8F4" />
      {/* Golden iris rings */}
      <rect x="8" y="12" width="18" height="20" fill="#D4A020" />
      <rect x="38" y="12" width="18" height="20" fill="#D4A020" />
      {/* Pupils - large and dark */}
      <rect x="12" y="16" width="10" height="12" fill="#0A0A14" />
      <rect x="42" y="16" width="10" height="12" fill="#0A0A14" />
      {/* Eye shine */}
      <rect x="13" y="17" width="3" height="3" fill="#E8E8F4" />
      <rect x="43" y="17" width="3" height="3" fill="#E8E8F4" />
      {/* Beak - small and sharp */}
      <rect x="28" y="32" width="8" height="10" fill="#C8A020" />
      <rect x="30" y="38" width="4" height="4" fill="#A07818" />
      {/* Round body */}
      <rect x="8" y="52" width="48" height="22" fill="#122A44" />
      {/* Wings folded */}
      <rect x="0" y="52" width="12" height="22" fill="#1A3A5C" />
      <rect x="52" y="52" width="12" height="22" fill="#1A3A5C" />
      {/* Belly pattern */}
      <rect x="20" y="56" width="5" height="5" fill="#1A3A5C" />
      <rect x="32" y="60" width="5" height="5" fill="#1A3A5C" />
      <rect x="39" y="54" width="5" height="5" fill="#1A3A5C" />
      {/* Talons */}
      <rect x="14" y="70" width="14" height="6" fill="#0A1828" />
      <rect x="36" y="70" width="14" height="6" fill="#0A1828" />
      <rect x="12" y="72" width="4" height="6" fill="#0A1828" />
      <rect x="48" y="72" width="4" height="6" fill="#0A1828" />
    </svg>
  );
}

function WolfSprite() {
  return (
    <svg width="64" height="80" viewBox="0 0 64 80" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      {/* Pointed ears */}
      <rect x="8" y="0" width="16" height="16" fill="#4A5E74" />
      <rect x="40" y="0" width="16" height="16" fill="#4A5E74" />
      {/* Inner ears - lighter */}
      <rect x="11" y="2" width="10" height="11" fill="#C8C8D8" />
      <rect x="43" y="2" width="10" height="11" fill="#C8C8D8" />
      {/* Head base */}
      <rect x="8" y="8" width="48" height="38" fill="#4A5E74" />
      {/* Cheek fur - lighter grey */}
      <rect x="8" y="20" width="12" height="18" fill="#C8C8D8" />
      <rect x="44" y="20" width="12" height="18" fill="#C8C8D8" />
      {/* Eyes - amber/gold */}
      <rect x="14" y="14" width="12" height="10" fill="#E8E8F4" />
      <rect x="38" y="14" width="12" height="10" fill="#E8E8F4" />
      <rect x="17" y="16" width="6" height="6" fill="#E8A020" />
      <rect x="41" y="16" width="6" height="6" fill="#E8A020" />
      <rect x="18" y="17" width="2" height="2" fill="#E8E8F4" />
      <rect x="42" y="17" width="2" height="2" fill="#E8E8F4" />
      {/* Snout - elongated, the key wolf feature */}
      <rect x="16" y="26" width="32" height="18" fill="#5A7090" />
      {/* Nose */}
      <rect x="24" y="26" width="16" height="8" fill="#1A2030" />
      <rect x="28" y="28" width="8" height="4" fill="#2A3040" />
      {/* Mouth */}
      <rect x="20" y="38" width="24" height="6" fill="#1A2030" />
      {/* Body */}
      <rect x="8" y="46" width="48" height="26" fill="#3A4E64" />
      {/* Chest lighter */}
      <rect x="18" y="48" width="28" height="20" fill="#C8C8D8" />
      {/* Legs */}
      <rect x="10" y="68" width="16" height="8" fill="#4A5E74" />
      <rect x="38" y="68" width="16" height="8" fill="#4A5E74" />
    </svg>
  );
}

function SharkSprite() {
  return (
    <svg width="64" height="80" viewBox="0 0 64 80" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      {/* Dorsal fin - KEY identifier */}
      <rect x="30" y="2" width="14" height="20" fill="#1A4A7C" />
      <rect x="34" y="0" width="10" height="6" fill="#1A4A7C" />
      <rect x="40" y="2" width="4" height="14" fill="#0A3060" />
      {/* Main body - torpedo shape */}
      <rect x="8" y="20" width="52" height="32" fill="#1A5A8C" />
      {/* Head/snout - forward point */}
      <rect x="0" y="24" width="16" height="24" fill="#1A5A8C" />
      <rect x="0" y="28" width="6" height="16" fill="#154E7C" />
      {/* White belly */}
      <rect x="0" y="36" width="56" height="12" fill="#D0D8E8" />
      {/* Eye - black dot, positioned on head */}
      <rect x="2" y="26" width="8" height="8" fill="#0A0A14" />
      <rect x="3" y="27" width="3" height="3" fill="#E8E8F4" />
      {/* Gill slits */}
      <rect x="18" y="22" width="3" height="20" fill="#0A3060" />
      <rect x="23" y="22" width="3" height="20" fill="#0A3060" />
      {/* Pectoral fin */}
      <rect x="22" y="38" width="22" height="12" fill="#154E7C" />
      <rect x="22" y="46" width="22" height="4" fill="#104070" />
      {/* Tail fins */}
      <rect x="56" y="18" width="8" height="14" fill="#1A4A7C" />
      <rect x="56" y="36" width="8" height="14" fill="#1A4A7C" />
      <rect x="58" y="20" width="6" height="8" fill="#0A3060" />
      <rect x="58" y="38" width="6" height="8" fill="#0A3060" />
      {/* Motion lines — always moving */}
      <rect x="50" y="22" width="8" height="3" fill="#0A2A5C" />
      <rect x="52" y="30" width="8" height="3" fill="#0A2A5C" />
      <rect x="50" y="44" width="8" height="3" fill="#0A2A5C" />
    </svg>
  );
}

const SPRITES: Record<AnimalKey, () => ReactElement> = {
  gorilla: GorillaSprite,
  tiger: TigerSprite,
  cheetah: CheetahSprite,
  lion: LionSprite,
  hyena: HyenaSprite,
  owl: OwlSprite,
  wolf: WolfSprite,
  shark: SharkSprite,
};

interface AnimalArchetypeCardProps {
  animalKey: AnimalKey;
  compact?: boolean;
}

export default function AnimalArchetypeCard({ animalKey, compact = false }: AnimalArchetypeCardProps) {
  const animal = ANIMAL_ARCHETYPES[animalKey];
  const Sprite = SPRITES[animalKey];

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2"
        style={{
          background: animal.bgColor,
          border: `1px solid ${animal.color}30`,
        }}
      >
        <div
          className="rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ width: 40, height: 40, background: `${animal.color}18` }}
        >
          <div style={{ transform: "scale(0.55)", transformOrigin: "center", width: 64, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sprite />
          </div>
        </div>
        <div>
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: animal.color }}>
            {animal.name}
          </p>
          <p className="text-[11px]" style={{ color: "#8898a8" }}>{animal.tagline}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: animal.bgColor,
        border: `1px solid ${animal.color}28`,
        minWidth: 160,
        maxWidth: 200,
      }}
    >
      {/* Sprite display area */}
      <div
        className="flex items-end justify-center pt-6 pb-2 relative"
        style={{
          background: `linear-gradient(180deg, ${animal.color}18 0%, ${animal.bgColor} 100%)`,
          minHeight: 100,
        }}
      >
        {/* Subtle glow behind character */}
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full blur-xl"
          style={{ width: 60, height: 20, background: animal.color, opacity: 0.25 }}
        />
        <Sprite />
      </div>

      {/* Label */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base font-bold" style={{ color: animal.color }}>
            {animal.name}
          </span>
          <span
            className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{ background: `${animal.color}22`, color: animal.color }}
          >
            {animal.tagline}
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#7888a0" }}>
          {animal.description.slice(0, 120)}…
        </p>
      </div>

      {/* Superpower footer */}
      <div
        className="px-4 py-2 mt-auto"
        style={{ borderTop: `1px solid ${animal.color}18` }}
      >
        <p className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: `${animal.color}90` }}>
          Superpower
        </p>
        <p className="text-xs" style={{ color: "#6878a0" }}>{animal.superpower}</p>
      </div>
    </div>
  );
}
