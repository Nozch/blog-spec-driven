/**
 * Root Layout
 *
 * Minimal root layout for Next.js 14 App Router
 */

export const metadata = {
  title: 'Blog Editor',
  description: 'Personal blog publishing platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
