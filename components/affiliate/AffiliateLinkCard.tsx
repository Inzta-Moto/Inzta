'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, Link as LinkIcon, Share } from 'lucide-react';
import { affiliateLink, displayLink, voucherDiscountLabel, voucherExpiryLabel, type AffVoucher } from '@/lib/affiliate/dashboard';

export type AffiliateLinkCardProps = {
  code: string;
  voucher: AffVoucher;
  /** Key of the control that was just copied ('link' | 'code'), from useCopy. */
  copiedKey: string | null;
  /** Key of the control whose last copy failed, from useCopy. */
  failedKey: string | null;
  onCopyLink: () => void;
  onCopyCode: () => void;
};

/**
 * Ticket-shaped affiliate card on the dark band (F-023 E8): link half, perforation with two notches, voucher half.
 * The link is shown without https:// and copied in full. "Bagikan" only renders when the browser has a share sheet,
 * checked after mount so the server HTML and the first client render match.
 */
export default function AffiliateLinkCard({ code, voucher, copiedKey, failedKey, onCopyLink, onCopyCode }: AffiliateLinkCardProps) {
  const [canShare, setCanShare] = useState(false);
  const linkRef = useRef<HTMLSpanElement>(null);
  const link = affiliateLink(code);
  const discount = voucherDiscountLabel(voucher);
  const expiry = voucherExpiryLabel(voucher);
  const linkCopied = copiedKey === 'link';
  const codeCopied = copiedKey === 'code';
  const linkFailed = failedKey === 'link';
  const codeFailed = failedKey === 'code';

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // After a failed copy the link text is pre-selected, so a long press or Ctrl+C is all that is left to do.
  useEffect(() => {
    if (!linkFailed || !linkRef.current) return;
    try {
      window.getSelection()?.selectAllChildren(linkRef.current);
    } catch {
      // Selection is a convenience only.
    }
  }, [linkFailed]);

  const onShare = async () => {
    try {
      await navigator.share({ url: link });
    } catch (err) {
      // Closing the share sheet rejects with AbortError: the affiliate changed their mind, nothing to report.
      if (err instanceof Error && err.name === 'AbortError') return;
      // Any other refusal (no permission, unsupported target) falls back to copying, which has its own feedback.
      onCopyLink();
    }
  };

  return (
    <section className="iz-aff-ticket" aria-labelledby="iz-aff-ticket-title">
      <div className="iz-aff-ticket__top">
        <div className="iz-aff-ticket__head">
          <span className="iz-aff-ticket__tile" aria-hidden="true">
            <LinkIcon />
          </span>
          <div className="iz-aff-ticket__heading">
            <h2 id="iz-aff-ticket-title" className="iz-aff-ticket__title">
              Link affiliate
            </h2>
            <p className="iz-aff-ticket__sub">Bagikan ke calon pembeli</p>
          </div>
        </div>
        <div className="iz-aff-ticket__link" data-failed={linkFailed ? 'true' : undefined}>
          <span ref={linkRef} className="iz-aff-ticket__linktext" translate="no">
            {displayLink(code)}
          </span>
        </div>
        <div className="iz-aff-ticket__actions" data-share={canShare ? 'true' : undefined}>
          <button type="button" className="iz-aff-btn iz-aff-btn--primary" onClick={onCopyLink}>
            {linkCopied ? <Check aria-hidden="true" strokeWidth={2.5} /> : <Copy aria-hidden="true" />}
            {linkCopied ? 'Disalin' : 'Salin link'}
          </button>
          {canShare && (
            <button type="button" className="iz-aff-btn iz-aff-btn--on-dark" onClick={onShare}>
              <Share aria-hidden="true" />
              Bagikan
            </button>
          )}
        </div>
        {linkFailed && (
          <p className="iz-aff-ticket__fail" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>Gagal menyalin. Tekan lama teks link di atas, lalu salin manual.</span>
          </p>
        )}
      </div>
      <div className="iz-aff-ticket__perf" aria-hidden="true" />
      <div className="iz-aff-ticket__bottom">
        <p className="iz-aff-ticket__label">Kode voucher</p>
        <div className="iz-aff-ticket__coderow">
          <p className="iz-aff-ticket__code" translate="no">
            {code}
          </p>
          <button type="button" className="iz-aff-iconbtn iz-aff-iconbtn--lg iz-aff-iconbtn--on-dark" onClick={onCopyCode} aria-label="Salin kode">
            {codeCopied ? <Check aria-hidden="true" strokeWidth={2.5} /> : <Copy aria-hidden="true" />}
          </button>
        </div>
        {codeFailed && (
          <p className="iz-aff-ticket__fail" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>Gagal menyalin. Tekan lama kode di atas, lalu salin manual.</span>
          </p>
        )}
        {(discount || expiry) && (
          <ul className="iz-aff-ticket__chips" role="list">
            {discount && <li className="iz-aff-ticket__chip iz-aff-ticket__chip--accent">{discount}</li>}
            {expiry && <li className="iz-aff-ticket__chip">{expiry}</li>}
          </ul>
        )}
      </div>
    </section>
  );
}
