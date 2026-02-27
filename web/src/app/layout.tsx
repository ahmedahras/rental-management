import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shop Management',
  description: 'Admin-only rent and invoice management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  );
}
