import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerProvider } from "../components/pwa/service-worker-provider";
import { AuthProvider } from "../lib/auth-provider";
import { SiteHeader } from "./_components/site-header";
import { sans, serif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SoulBound",
    template: "%s | SoulBound",
  },
  description: "입장 심사를 기반으로 신뢰를 먼저 세우는 비공개 커뮤니티",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SoulBound",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#D97757",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${sans.variable} ${serif.variable}`} lang="ko">
      <body>
        <AuthProvider>
          <SiteHeader />
          {children}
          <ServiceWorkerProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
