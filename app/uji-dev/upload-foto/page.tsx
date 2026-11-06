import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { devFixtureEnabled } from '@/lib/v2/dev-fixture';
import UploadHarness from './UploadHarness';

// F-022 test page for tests/f022-browser.cjs: the real admin uploader (components/ImageUpload.tsx) without login.
// Exists only in local development with the fixture on (NODE_ENV not production AND F016_FIXTURE set, the same rule
// as lib/v2/dev-fixture.ts); every production build answers 404.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Page() {
  if (!devFixtureEnabled()) notFound();
  return <UploadHarness />;
}
