import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Startup Day 2026 — Subasta de Patrocinios',
  description: 'Subastá un lugar para tu marca en la pancarta principal de Startup Day 2026.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'Startup Day 2026 — Subasta de Patrocinios',
    description: 'Subastá un lugar para tu marca en la pancarta principal de Startup Day 2026.',
    type: 'website',
    locale: 'es_AR',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: 'Startup Day 2026 — Subasta de Patrocinios',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Startup Day 2026 — Subasta de Patrocinios',
    description: 'Subastá un lugar para tu marca en la pancarta principal de Startup Day 2026.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
