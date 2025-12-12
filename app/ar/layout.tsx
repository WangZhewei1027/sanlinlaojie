import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AR Experience | Sanlinlaojie",
  description: "Web AR experience using Zappar",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function ARLayout({ children }: { children: React.ReactNode }) {
  return children;
}
