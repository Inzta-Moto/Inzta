import type { ReactNode } from 'react';
import Link from 'next/link';
import V2Layout from '@/components/v2/V2Layout';
import { BUSINESS_ADDRESS, BUSINESS_EMAIL, BUSINESS_NAME, WA_NUMBER } from '@/lib/constants';
import { formatWaDisplay } from '@/lib/v2/home-data';
import '@/app/(v2)/v2-legal.css';

// Kebijakan Privasi and Syarat dan Ketentuan (F-004, Google Ads destination requirements, 2026-11-02). Same frame as
// /blog: v2 navbar and footer, one reading column, the date the text took effect, and the contact block at the end.
export default function LegalPage({ title, lead, updated, children }: { title: string; lead: string; updated: string; children: ReactNode }) {
  return (
    <V2Layout>
      <div className="iz-wrap" style={{ paddingTop: 128 }}>
        <div className="iz-head" style={{ marginBottom: 24 }}>
          <h1 className="t-h1-shop">{title}</h1>
          <p className="t-lead">{lead}</p>
          <p className="iz-legal__updated">Berlaku sejak {updated}</p>
        </div>
        <article className="iz-legal">
          {children}
          <h2 id="kontak">Kontak</h2>
          <p>Pertanyaan tentang halaman ini dapat dikirim ke:</p>
          <address className="iz-legal__contact">
            <strong>{BUSINESS_NAME}</strong>
            {BUSINESS_ADDRESS.map(line => (
              <span key={line}>{line}</span>
            ))}
            <span>
              Email: <a href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a>
            </span>
            <span>
              WhatsApp:{' '}
              <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer">
                {formatWaDisplay(WA_NUMBER)}
              </a>
            </span>
          </address>
          <p className="iz-legal__see">
            Lihat juga: <Link href="/kebijakan-privasi">Kebijakan Privasi</Link> · <Link href="/syarat-ketentuan">Syarat dan Ketentuan</Link> ·{' '}
            <Link href="/tentang">Tentang INZTA</Link>
          </p>
        </article>
      </div>
    </V2Layout>
  );
}
