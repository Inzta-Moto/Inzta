'use client';

import { useState } from 'react';
import ImageUpload from '@/components/ImageUpload';
import '@/app/admin/admin.css';

const SEED = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/f022/';

// Two uploaders like the product form: the gallery (max 10) and a variant photo (max 1). The <pre> blocks show the
// list the form would save; "busy" mirrors the form's Save lock (onBusyChange).
export default function UploadHarness() {
  const [ten, setTen] = useState<string[]>([]);
  const [one, setOne] = useState<string[]>([]);
  const [busy, setBusy] = useState(0);
  const [shown, setShown] = useState(true);
  const track = (b: boolean) => setBusy(n => Math.max(0, n + (b ? 1 : -1)));
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <p>busy: <span id="busy">{busy}</span></p>
      <button id="toggle" type="button" onClick={() => setShown(s => !s)}>toggle</button>
      <button id="seed11" type="button" onClick={() => setTen(Array.from({ length: 11 }, (_, i) => `${SEED}p${(i % 10) + 1}.jpg`))}>seed11</button>
      {shown && (
        <section id="ten">
          <h2>max 10</h2>
          <ImageUpload value={ten} onChange={setTen} max={10} onBusyChange={track} />
        </section>
      )}
      <pre id="ten-value">{JSON.stringify(ten)}</pre>
      <section id="one">
        <h2>max 1</h2>
        <ImageUpload value={one} onChange={setOne} max={1} onBusyChange={track} />
        <pre id="one-value">{JSON.stringify(one)}</pre>
      </section>
    </main>
  );
}
