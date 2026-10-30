'use client';

import { useEffect, useState } from 'react';
import { WhatsApp } from '@/components/v2/icons';

/**
 * "Bagikan:" row (F-016 S7.5, artikel.dc.html:76). WhatsApp is a link with today's BlogDetailClient text; it shares
 * the article and does not chat with the admin, so it is the one wa.me link without WA_NUMBER (S0.10.1 exception).
 * The server HTML carries the canonical URL; after mount the address bar without its #fragment is used, so an
 * affiliate's ?aff= stays in shared links (S7.5.2). "Salin tautan" exists only where the Clipboard API does (S7.5.3).
 * F-017: `icons` is the left-rail version, the same two actions as round icon buttons.
 */
export default function ShareRow({ title, excerpt, url, variant = 'row' }: { title: string; excerpt: string; url: string; variant?: 'row' | 'icons' }) {
  const [shareUrl, setShareUrl] = useState(url);
  const [canCopy, setCanCopy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setShareUrl(window.location.href.split('#')[0]);
    setCanCopy(typeof navigator.clipboard?.writeText === 'function');
  }, []);

  const text = `*${title}*\n\n${excerpt ? `${excerpt}\n\n` : ''}Baca selengkapnya: ${shareUrl}`;

  // The message follows the promise, unlike the old toast that said "disalin" before the copy settled.
  async function copy() {
    setMessage('');
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage('Tautan disalin.');
    } catch {
      setMessage('Tautan gagal disalin. Salin dari kolom alamat.');
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const linkIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );

  if (variant === 'icons') {
    return (
      <div className="iz-share iz-share--icons">
        <span>Bagikan</span>
        <a className="iz-iconbtn" href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Bagikan ke WhatsApp">
          <WhatsApp />
        </a>
        {canCopy && (
          <button className="iz-iconbtn" type="button" onClick={copy} aria-label="Salin tautan artikel">
            {linkIcon}
          </button>
        )}
        <span className="iz-share__msg" aria-live="polite">{message}</span>
      </div>
    );
  }

  return (
    <div className="iz-share">
      <span>Bagikan:</span>
      <a className="iz-fchip" href={waHref} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
      {canCopy && (
        <button className="iz-fchip" type="button" onClick={copy}>
          {linkIcon}
          Salin tautan
        </button>
      )}
      <span className="iz-share__msg" aria-live="polite">{message}</span>
    </div>
  );
}
