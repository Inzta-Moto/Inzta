'use client';

import { useEffect, useState } from 'react';
import { WARRANTY_COPY } from '@/lib/warranty/copy';

// F-031 10.1: "Ajukan klaim" | "Kirim masukan" at the top of /garansi. Plain links to #klaim and #masukan, so the
// banner URL reaches both forms without JavaScript; aria-current follows the hash.
const P = WARRANTY_COPY.page;

export default function FormSwitch() {
  const [active, setActive] = useState<'klaim' | 'masukan'>('klaim');
  useEffect(() => {
    const read = () => setActive(window.location.hash === '#masukan' ? 'masukan' : 'klaim');
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  return (
    <nav className="iz-gr-switch" aria-label={P.switchLabel}>
      <a href="#klaim" aria-current={active === 'klaim' ? 'true' : undefined} onClick={() => setActive('klaim')}>
        {P.switchClaim}
      </a>
      <a href="#masukan" aria-current={active === 'masukan' ? 'true' : undefined} onClick={() => setActive('masukan')}>
        {P.switchFeedback}
      </a>
    </nav>
  );
}
