/**
 * Home Page
 *
 * Simple landing page for E2E testing
 */

import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Blog Editor</h1>
      <p>
        <Link href="/compose">Go to Compose Editor</Link>
      </p>
    </div>
  );
}
