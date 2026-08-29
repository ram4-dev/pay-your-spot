import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hacer una oferta — Startup Day 2026',
  description: 'Hacé una oferta por una ubicación en la pancarta principal de Startup Day 2026.',
};

export default function BidLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
