import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

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
    <html lang="en" className="dark">
<<<<<<< Updated upstream
      <body className="antialiased bg-[#080809] text-[#eaeaea]">
        {children}
=======
      <body className="antialiased bg-[#0f0f11] text-[#e8e8ec]">
        <SessionProvider>{children}</SessionProvider>
>>>>>>> Stashed changes
      </body>
    </html>
  );
}
