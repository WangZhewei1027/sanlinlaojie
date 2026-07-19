import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/components/i18n-provider";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  resolveLanguage,
} from "@/lib/i18n/settings";
import { Navbar } from "@/components/navbar";
import { WorkspaceProvider } from "@/app/manage/components/WorkspaceProvider";
import { Toaster } from "@/components/ui/sonner";
import { ErrorReporter } from "@/components/error-reporter";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Interactive Heritage Experience",
  description:
    "Explore the rich history and culture of Sanlin Old Street through immersive augmented reality experiences and interactive maps",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

// cacheComponents 模式下 cookies() 只能在 Suspense 边界内访问,
// 所以语言解析放在这个异步子组件里,而不是布局顶层
async function I18nFromCookie({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const lang = resolveLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value);
  return <I18nProvider lang={lang}>{children}</I18nProvider>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LANGUAGE} suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        {/* <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        > */}
        <Suspense fallback={null}>
          <I18nFromCookie>
            <WorkspaceProvider>
              <Navbar />
              {children}
            </WorkspaceProvider>
          </I18nFromCookie>
        </Suspense>
        <Toaster />
        <ErrorReporter />
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}
