import type { Metadata } from "next";
import { Syne, Instrument_Serif, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nivarro — Build your team",
  description:
    "A platform for ambitious people to connect, understand each other's strengths, and build effective teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${instrumentSerif.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <body className="antialiased" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
