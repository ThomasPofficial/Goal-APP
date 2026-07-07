"use client";
import dynamic from "next/dynamic";

export const DestinationsMap = dynamic(
  () => import("@/components/school/DestinationsMap"),
  { ssr: false }
);

export const BrochureButton = dynamic(
  () => import("@/components/school/BrochureButton"),
  { ssr: false }
);

export const BrochureCurationPanel = dynamic(
  () => import("@/components/school/BrochureCurationPanel"),
  { ssr: false }
);
