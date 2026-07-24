import type { Metadata } from "next";
import { Playfair_Display, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const SITE_URL = "https://calcshore.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CalcSHore: Thermal Control Plans for Mass Concrete",
  description:
    "From spec sheet to stamp-ready submittal in hours. Simulation-backed thermal control plans, formatted for PE seal and DOT submittal.",
  icons: {
    // The <link rel="icon"> is single-sourced to /favicon.svg — the only icon
    // Next emits in <head>. public/favicon.ico is a separate FORMAT fallback
    // served directly at /favicon.ico (browsers, crawlers and unfurlers request
    // that path regardless of link tags); it deliberately has no <link> or
    // metadata.icons entry. The competing icon *design* app/icon.svg stays removed.
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "CalcSHore",
    title: "CalcSHore: Thermal Control Plans for Mass Concrete",
    description:
      "From spec sheet to stamp-ready submittal in hours. Simulation-backed thermal control plans, formatted for PE seal and DOT submittal.",
    // TODO: interim OG image. /logo-horizontal.png is 3001×865 (~3.47:1), not the
    // 1200×630 (1.91:1) OG standard, so it will letterbox in most unfurlers.
    // Replace with a purpose-built 1200×630 asset.
    images: [
      {
        url: "/logo-horizontal.png",
        width: 3001,
        height: 865,
        alt: "CalcShore",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CalcSHore: Thermal Control Plans for Mass Concrete",
    description:
      "From spec sheet to stamp-ready submittal in hours. Simulation-backed thermal control plans, formatted for PE seal and DOT submittal.",
    // TODO: same interim OG image as above — replace with 1200×630.
    images: ["/logo-horizontal.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
