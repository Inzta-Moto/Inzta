'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BagPosition } from '@/types';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { formatRupiah } from '@/lib/v2/home-data';
import { MOTOR_CATEGORIES, POSITION_ITEMS, categoryLabel } from '@/lib/v2/home-content';
import { useMotorCategory } from '@/components/v2/MotorCategory';
import CategoryLink from '@/components/v2/CategoryLink';
import { ArrowRight, ChevronDown, Close, Menu, Motorcycle, WhatsApp } from '@/components/v2/icons';

type OpenMenu = 'produk' | 'motor' | null;
export type NavTab = 'produk' | 'motor' | 'artikel' | 'tentang';

function thumb(src: string): string {
  return src.includes('res.cloudinary.com') ? optimizeCloudinaryUrl(src, 80, 80) : src;
}

// Capsule navbar (F-016 4): dropdowns open on hover for fine pointers (CSS) and by click or keyboard (state),
// phone menu below 768 px. Dark over the hero, light once the hero has scrolled away (4.2).
export default function SiteNav({
  minPrices,
  waHref,
  current,
}: {
  minPrices: Record<BagPosition, number | null>;
  waHref: string;
  current?: NavTab;
}) {
  const page = (tab: NavTab) => (current === tab ? ({ 'aria-current': 'page' } as const) : {});
  const { category } = useMotorCategory();
  const [open, setOpen] = useState<OpenMenu>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [overHero, setOverHero] = useState(true);
  const navRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = { produk: useRef<HTMLButtonElement>(null), motor: useRef<HTMLButtonElement>(null) };

  useEffect(() => {
    const end = document.querySelector('[data-hero-end]');
    if (!end) {
      setOverHero(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => setOverHero(e.isIntersecting || e.boundingClientRect.top > 0), {
      rootMargin: '-96px 0px 0px 0px',
    });
    io.observe(end);
    return () => io.disconnect();
  }, []);

  const closeMenu = useCallback((focusTrigger: boolean) => {
    setOpen(prev => {
      if (focusTrigger && prev) triggerRefs[prev].current?.focus();
      return null;
    });
    // triggerRefs hold stable ref objects, so the callback never needs to change.
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu(true);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, closeMenu]);

  // A phone menu left open while the window grows past the phone layout would keep the page locked (review REV-04).
  useEffect(() => {
    if (!sheetOpen) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => {
      if (mq.matches) setSheetOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [sheetOpen]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    menuBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSheet();
        return;
      }
      if (e.key !== 'Tab' || !sheetRef.current || !menuBtnRef.current) return;
      // Focus stays inside the menu button and the sheet while the phone menu is open (4.6).
      const items = [menuBtnRef.current, ...sheetRef.current.querySelectorAll<HTMLElement>('a, button')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [sheetOpen, closeSheet]);

  const onTriggerKey = (which: 'produk' | 'motor') => (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(which);
      // After React has rendered the open menu; setTimeout also runs in background tabs, unlike requestAnimationFrame.
      setTimeout(() => {
        document.getElementById(`iz-menu-${which}`)?.querySelector<HTMLElement>('a')?.focus();
      }, 0);
    }
  };

  // Tabbing out of an open dropdown closes it (review REV-06).
  const onMenuBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null);
  };

  const dark = overHero && !sheetOpen;
  const chosen = category ? categoryLabel(category) : null;

  return (
    <div className="iz-navwrap">
      <nav ref={navRef} className={`iz-nav${dark ? ' iz-nav--dark' : ''}`} aria-label="Utama">
        <Link className="iz-brand" href="/">
          <img src="/logo-inzta.png" alt="" width={32} height={32} />
          <span>INZTA</span>
        </Link>

        <div className="iz-nav__links">
          <div className="iz-navdd" data-open={open === 'produk' ? '' : undefined} onBlur={onMenuBlur}>
            <button
              ref={triggerRefs.produk}
              className="iz-navdd__btn"
              type="button"
              aria-expanded={open === 'produk'}
              aria-controls="iz-menu-produk"
              {...page('produk')}
              onClick={() => setOpen(o => (o === 'produk' ? null : 'produk'))}
              onKeyDown={onTriggerKey('produk')}
            >
              Produk <ChevronDown />
            </button>
            <div className="iz-navdd__menu" id="iz-menu-produk">
              {POSITION_ITEMS.map(item => (
                <Link key={item.value} className="iz-navdd__item" href="/produk" onClick={() => setOpen(null)}>
                  <span className="iz-navdd__ico">
                    <img src={thumb(item.image)} alt="" width={40} height={40} loading="lazy" />
                  </span>
                  <span>
                    {item.menuLabel}
                    {minPrices[item.value] !== null && <small>Mulai {formatRupiah(minPrices[item.value] as number)}</small>}
                  </span>
                </Link>
              ))}
              <Link className="iz-navdd__foot" href="/produk" onClick={() => setOpen(null)}>
                Semua produk <ArrowRight />
              </Link>
            </div>
          </div>

          <div className="iz-navdd" data-open={open === 'motor' ? '' : undefined} onBlur={onMenuBlur}>
            <button
              ref={triggerRefs.motor}
              className="iz-navdd__btn"
              type="button"
              aria-expanded={open === 'motor'}
              aria-controls="iz-menu-motor"
              {...page('motor')}
              onClick={() => setOpen(o => (o === 'motor' ? null : 'motor'))}
              onKeyDown={onTriggerKey('motor')}
            >
              Pilih motor <ChevronDown />
            </button>
            <div className="iz-navdd__menu" id="iz-menu-motor">
              {MOTOR_CATEGORIES.map(c => (
                <CategoryLink key={c.value} value={c.value} className="iz-navdd__item" onChosen={() => setOpen(null)}>
                  <span className="iz-navdd__ico">
                    <img src={c.image} alt="" width={40} height={40} loading="lazy" />
                  </span>
                  <span>{c.label}</span>
                  {category === c.value && <span className="iz-navdd__mine">Motor saya</span>}
                </CategoryLink>
              ))}
              <a className="iz-navdd__foot" href={waHref} target="_blank" rel="noopener noreferrer">
                Tidak yakin kategorinya? Tanya admin <ArrowRight />
              </a>
            </div>
          </div>

          <Link href="/blog" {...page('artikel')}>Artikel</Link>
          <Link href="/tentang" {...page('tentang')}>Tentang</Link>
        </div>

        <div className="iz-nav__actions">
          <Link className="iz-motorchip" href="/#garasi">
            {chosen ? (
              <>
                <span className="iz-motorchip__dot" />
                <span className="iz-only-desk">Motor saya: {chosen} · ganti</span>
                <span className="iz-only-mob">{chosen}</span>
              </>
            ) : (
              <>
                <Motorcycle width={18} height={18} />
                <span className="iz-only-desk">Pilih motor Anda</span>
                <span className="iz-only-mob iz-sr">Pilih motor Anda</span>
              </>
            )}
          </Link>
          <a className="iz-nav__cta iz-only-desk" href={waHref} target="_blank" rel="noopener noreferrer">
            <span>
              <WhatsApp />
            </span>
            Chat admin
          </a>
          <button
            ref={menuBtnRef}
            className="iz-nav__menu iz-only-mob"
            type="button"
            aria-label={sheetOpen ? 'Tutup menu' : 'Menu'}
            aria-expanded={sheetOpen}
            aria-controls="iz-msheet"
            onClick={() => (sheetOpen ? closeSheet() : setSheetOpen(true))}
          >
            {sheetOpen ? <Close width={20} height={20} /> : <Menu width={20} height={20} />}
          </button>
        </div>
      </nav>

      {sheetOpen && (
        <div className="iz-msheet iz-only-mob" id="iz-msheet" ref={sheetRef}>
          <div className="iz-msheet__group">
            <h2>Produk</h2>
            {POSITION_ITEMS.map(item => (
              <Link key={item.value} className="iz-msheet__row" href="/produk" onClick={() => setSheetOpen(false)}>
                <span>{item.menuLabel}</span>
                {minPrices[item.value] !== null && <small>Mulai {formatRupiah(minPrices[item.value] as number)}</small>}
              </Link>
            ))}
            <Link className="iz-link" href="/produk" style={{ paddingInline: 8 }} onClick={() => setSheetOpen(false)}>
              Semua produk <ArrowRight width={18} height={18} />
            </Link>
          </div>
          <div className="iz-msheet__group">
            <h2>Pilih motor</h2>
            {MOTOR_CATEGORIES.map(c => (
              <CategoryLink key={c.value} value={c.value} className="iz-msheet__row" onChosen={() => setSheetOpen(false)}>
                <span>{c.label}</span>
                {category === c.value && <span className="iz-navdd__mine">Motor saya</span>}
              </CategoryLink>
            ))}
          </div>
          <div className="iz-msheet__links">
            <Link href="/blog" onClick={() => setSheetOpen(false)}>Artikel</Link>
            <Link href="/tentang" onClick={() => setSheetOpen(false)}>Tentang</Link>
          </div>
          <div className="iz-wa" style={{ width: '100%' }}>
            <a className="iz-btn iz-btn--primary iz-btn--wa" href={waHref} target="_blank" rel="noopener noreferrer">
              <span className="iz-btn__icon">
                <WhatsApp />
              </span>
              <span>Chat admin</span>
            </a>
            <span className="iz-wa__note">Anda akan diarahkan ke WhatsApp</span>
          </div>
        </div>
      )}
    </div>
  );
}
