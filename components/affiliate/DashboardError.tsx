'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, MessageCircle, RefreshCw } from 'lucide-react';
import HeroBand, { DashboardFrame } from './HeroBand';
import { whatsappUrl } from '@/lib/affiliate/dashboard';
import { WA_NUMBER } from '@/lib/constants';

/**
 * Error state of the dashboard (F-023 E16, FR-08): the session is still valid but the data read failed, so the band
 * and "Keluar" stay and the card offers a retry and the admin chat. Focus moves to the card title so screen readers
 * hear what happened.
 */
export default function DashboardError({ onRetry }: { onRetry: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const chat = whatsappUrl(WA_NUMBER, 'Halo Admin INZTA, saya affiliate. Data komisi di dashboard affiliate gagal dimuat.');

  return (
    <DashboardFrame band={<HeroBand showRoute={false} />}>
      <div className="iz-aff-content">
        <div className="iz-aff-topo iz-aff-topo--ink iz-aff-topo--fade iz-aff-content__topo" aria-hidden="true" />
        <div className="iz-aff-container iz-aff-content__stack">
          <section className="iz-aff-card iz-aff-error" aria-labelledby="iz-aff-error-title">
            <span className="iz-aff-error__tile" aria-hidden="true">
              <AlertTriangle />
            </span>
            <h2 id="iz-aff-error-title" ref={titleRef} tabIndex={-1} className="iz-aff-error__title">
              Data komisi gagal dimuat.
            </h2>
            <p className="iz-aff-error__text">Sesi Anda masih aktif. Periksa koneksi lalu coba lagi. Bila masih gagal, chat admin INZTA.</p>
            <div className="iz-aff-error__actions">
              <button type="button" className="iz-aff-btn iz-aff-btn--primary" onClick={onRetry}>
                <RefreshCw aria-hidden="true" />
                Coba lagi
              </button>
              <a href={chat} target="_blank" rel="noopener noreferrer" className="iz-aff-btn iz-aff-btn--ghost">
                <MessageCircle aria-hidden="true" />
                Chat admin INZTA
              </a>
            </div>
          </section>
        </div>
      </div>
    </DashboardFrame>
  );
}
