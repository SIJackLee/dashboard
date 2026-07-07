import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationPendingProvider } from "@/components/layout/navigation-pending-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "스마트 축사 IoT",
  description: "스마트 축사 IoT 모니터링 및 제어 대시보드",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-muted/30 dark:bg-background">
        <Script id="dashboard-theme-init" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("dashboard-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}`}
        </Script>
        <TooltipProvider>
          <NavigationPendingProvider>{children}</NavigationPendingProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
