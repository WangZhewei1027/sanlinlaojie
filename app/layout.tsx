import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/components/i18n-provider";
import { Navbar } from "@/components/navbar";
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
        {/* <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        > */}
        <I18nProvider>
          <WorkspaceProvider>
            <Navbar />
            {children}
          </WorkspaceProvider>
        </I18nProvider>
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}
