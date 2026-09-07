import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'EASE HOME | Video-first real estate marketplace',
  description:
    'Discover verified properties through immersive video, structured search and guided site visits.',
  openGraph: {
    title: 'EASE HOME | Video-first real estate marketplace',
    description:
      'Discover verified properties through immersive video, structured search and guided site visits.',
    images: [{ url: '/og.png', width: 1741, height: 909, alt: 'EASE HOME video-first real estate marketplace' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EASE HOME | Video-first real estate marketplace',
    description:
      'Discover verified properties through immersive video, structured search and guided site visits.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
