import type { Metadata, Viewport } from "next";
import { SITE_NAME, SITE_TAGLINE } from "./lib/config";
import { AuthProvider } from "./lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "Shown an NHL player, guess whether they ever played a game for the team. Build a streak; one miss ends the run. Every team, its own board.",
};

export const viewport: Viewport = {
  themeColor: "#16202e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
