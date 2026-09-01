import type { Metadata } from "next";
import { IBM_Plex_Mono,Inter,Sora } from "next/font/google";

import "./globals.css";

const sora=Sora({subsets:["latin"],variable:"--font-display"});
const inter=Inter({subsets:["latin"],variable:"--font-body"});
const mono=IBM_Plex_Mono({subsets:["latin"],weight:["500","600","700"],variable:"--font-mono"});

export const metadata: Metadata = {
  title: "Startup Day × Compass — Subasta de lugares",
  description:
    "Elegí un lugar, ofertá en pesos y asegurá la presencia de tu marca en Startup Day 2026.",
  icons: {
    icon: "https://compassguard.xyz/art/compass-brand-logo.webp",
    apple: "https://compassguard.xyz/art/compass-brand-logo.webp",
  },
  openGraph: {
    title: "Startup Day × Compass — Subasta de lugares",
    description: "Subasta en vivo de los lugares de la pancarta principal.",
    locale: "es_AR",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${sora.variable} ${inter.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
