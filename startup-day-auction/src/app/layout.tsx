import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Startup Day 2026 — Subasta de Patrocinios",
  description:
    "Elegí un lugar, ofertá en pesos y asegurá la presencia de tu marca en Startup Day 2026.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Startup Day 2026 — Subasta de Patrocinios",
    description: "Subasta en vivo de los lugares de la pancarta principal.",
    locale: "es_AR",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
