import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Provider } from "@/components/provider";
import { appName, siteUrl as productionUrl, tagline } from "@/lib/shared";
import "./global.css";

const sans = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist",
});

const mono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
});

/** DOCS_SITE_URL wins, then the Vercel production domain, then the public URL. */
function siteUrl() {
  if (process.env.DOCS_SITE_URL) return process.env.DOCS_SITE_URL;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercelHost ? `https://${vercelHost}` : productionUrl;
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${appName}: ${tagline}`,
    template: `%s · ${appName}`,
  },
  description:
    "Sentence outlines, a gliding word cursor, drawn selections and marks for PDF.js pages and HTML text. Positions come from the glyphs. Framework-free core with React and Svelte adapters.",
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
