import './globals.css';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata = {
  title: 'Mario — Proof, not promises.',
  description:
    "The proof layer for residential real estate. Every tile, every coat, every fitting — photographed on site, geofenced, approved by four people who put their name on it.",
  icons: {
    icon: '/brand/favicon.svg',
  },
};

export const viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#FAFAFA] text-slate-900 antialiased min-h-screen">{children}</body>
    </html>
  );
}
