import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Cormorant_Garamond, DM_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
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
    <html lang="en" className={`${plusJakarta.variable} ${cormorant.variable} ${dmMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {/* Inline script prevents flash of wrong theme on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('nivarro-theme')==='light')document.body.classList.add('day')}catch(e){}`,
          }}
        />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
