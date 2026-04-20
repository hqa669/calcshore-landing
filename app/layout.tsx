import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalcShore — Concrete Compliance Documentation",
  description:
    "Concrete compliance documentation, automated. Access CalcShore TCP and CalcShore Mix Design.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
