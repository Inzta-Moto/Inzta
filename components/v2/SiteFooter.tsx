import Link from 'next/link';
import { formatWaDisplay } from '@/lib/v2/home-data';
import { INSTAGRAM, MOTOR_CATEGORIES, SHOP_LINKS } from '@/lib/v2/home-content';
import type { MotorCategory } from '@/types';
import CategoryLink from '@/components/v2/CategoryLink';
import { ArrowUpRight } from '@/components/v2/icons';

// F-016 S0.7: position keys shared with the catalog filter (S2.2).
const PRODUCT_LINKS = [
  { key: 'tank', label: 'Tank bag' },
  { key: 'side', label: 'Side bag' },
  { key: 'tail', label: 'Tail bag' },
  { key: 'extend', label: 'Extend bag' },
  { key: 'aksesori', label: 'Aksesori touring' },
  { key: 'harian', label: 'Tas harian' },
];

// Footer (F-016 16, P2-3). Shop links stay text until their URLs are known (16.4).
export default function SiteFooter({ waHref, waNumber, currentCategory }: { waHref: string; waNumber: string; currentCategory?: MotorCategory }) {
  return (
    <footer className="iz-footer iz-dark">
      <div className="iz-footer__in">
        <div className="iz-footer__brand">
          <Link className="iz-brand" href="/">
            <img src="/logo-inzta.png" alt="" width={32} height={32} loading="lazy" />
            <span>INZTA</span>
          </Link>
          <p className="iz-footer__tag">Brand tas motor lokal sejak 2023.</p>
          {/* Copy reused from the Tentang hero and the Beranda "Mengapa pilih INZTA" list, so it adds no new claim (Sehan, 2026-10-29). */}
          <p className="iz-footer__about">
            Tank bag, side bag, tail bag, dan aksesori touring untuk rider Indonesia. Dirancang dan diproduksi sendiri, lalu
            dikirim dari gudang INZTA.
          </p>
          <p className="iz-footer__about">Pertanyaan dan pesanan dijawab admin INZTA lewat WhatsApp.</p>
        </div>
        <div>
          <h2>Produk</h2>
          <ul>
            {PRODUCT_LINKS.map(({ key, label }) => (
              <li key={key}>
                <Link href={`/produk?posisi=${key}`}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Pilih motor</h2>
          <ul>
            {MOTOR_CATEGORIES.map(c => (
              <li key={c.value}>
                <CategoryLink value={c.value} current={currentCategory === c.value}>{c.label}</CategoryLink>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Informasi</h2>
          <ul>
            <li><Link href="/tentang">Tentang INZTA</Link></li>
            <li><Link href="/tentang#cara-pesan">Cara pesan</Link></li>
            <li><Link href="/blog">Artikel</Link></li>
          </ul>
        </div>
        <div>
          <h2>Kontak</h2>
          <ul>
            <li>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <span>WhatsApp <span className="iz-nowrap">{formatWaDisplay(waNumber)}</span></span>
              </a>
            </li>
            <li>
              <a href={INSTAGRAM.href} target="_blank" rel="noopener noreferrer">
                <span>Instagram <span className="iz-nowrap">{INSTAGRAM.handle}</span></span>
              </a>
            </li>
          </ul>
          <h3 className="iz-footer__sub">Kanal toko</h3>
          <div className="iz-footer__shops">
            {SHOP_LINKS.map(s =>
              s.href ? (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.label}
                  <ArrowUpRight />
                </a>
              ) : (
                <span key={s.label}>{s.label}</span>
              ),
            )}
          </div>
        </div>
        <p className="iz-footer__bottom">© 2026 PT Inzta Gear Indonesia</p>
      </div>
    </footer>
  );
}
