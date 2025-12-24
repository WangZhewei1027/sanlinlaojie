import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/components/i18n-provider";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import Link from "next/link";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { hasEnvVars } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { WorkspaceSelect } from "@/app/manage/components/WorkspaceSelect";
import { WorkspaceProvider } from "@/app/manage/components/WorkspaceProvider";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Sanlin Old Street - Interactive AR Heritage Experience",
  description:
    "Explore the rich history and culture of Sanlin Old Street through immersive augmented reality experiences and interactive maps",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            <WorkspaceProvider>
              <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
                  <div className="flex gap-5 items-center font-semibold">
                    <Link href={"/"}>Sanlin Old Street</Link>
                    <Suspense>
                      <WorkspaceSelect />
                    </Suspense>
                  </div>
                  <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    <ThemeSwitcher />
                    {!hasEnvVars ? (
                      <EnvVarWarning />
                    ) : (
                      <Suspense>
                        <AuthButton />
                      </Suspense>
                    )}
                  </div>
                </div>
              </nav>
              {children}
            </WorkspaceProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
