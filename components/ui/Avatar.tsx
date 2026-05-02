"use client";

import Image from "next/image";
import { GENIUS_TYPES, type GeniusTypeKey } from "@/lib/geniusTypes";

interface AvatarProps {
  src?: string | null;
  displayName?: string | null;
  name?: string | null;
  geniusType?: GeniusTypeKey | null;
  size?: number | string;
  className?: string;
}

const NAMED_SIZES: Record<string, number> = { xs: 24, sm: 32, md: 40, lg: 48, xl: 56 };

export default function Avatar({ src, displayName, name, geniusType, size: sizeProp = 40, className = "" }: AvatarProps) {
  const size = typeof sizeProp === "string"
    ? (NAMED_SIZES[sizeProp] ?? (parseInt(sizeProp, 10) || 40))
    : sizeProp;
  displayName = displayName ?? name;
  const initials = displayName
    ? displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const ringColor = geniusType ? GENIUS_TYPES[geniusType].color : "#6B7280";

  return (
    <div
      className={`relative rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${ringColor}` }}
    >
      {src ? (
        <Image
          src={src}
          alt={displayName ?? "avatar"}
          fill
          className="rounded-full object-cover"
          sizes={`${size}px`}
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold"
          style={{ backgroundColor: ringColor, fontSize: size * 0.38 }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
