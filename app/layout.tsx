import type { Metadata } from "next";
import { Anton, Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import PostHogProvider from "@/components/providers/PostHogProvider";
import PostHogIdentify from "@/components/providers/PostHogIdentify";
import { Suspense } from "react";
import PostHogPageView from "@/components/providers/PostHogPageView";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
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
    <html lang="en" className={`${anton.variable} ${inter.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable}`}>
      <body className="antialiased" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('nivarro-theme')==='light')document.body.classList.add('day')}catch(e){}`,
          }}
        />
        <PostHogProvider>
          <SessionProvider>
            <PostHogIdentify />
            <Suspense>
              <PostHogPageView />
            </Suspense>
            {children}
          </SessionProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
