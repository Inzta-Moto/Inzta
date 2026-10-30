'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import type { CategoryTab } from '@/components/v2/motor/motor-page';
import { motionOn } from '@/lib/v2/motion/runtime';

const tabId = (key: string) => `iz-postab-${key}`;

// Position tabs of the category page (F-016 S5.2): a WAI-ARIA tablist with roving tabindex and manual activation.
// The grid is rendered on the server; selecting a tab only toggles `hidden` on its cards, so the island receives the
// position keys per card and no product data (S5.2.3). Without JavaScript the noscript style hides the tablist and
// every card stays visible (ST-NOJS).
export default function PositionTabs({ tabs, panelId, cardPositions }: { tabs: CategoryTab[]; panelId: string; cardPositions: string[][] }) {
  const [selected, setSelected] = useState<string>(tabs[0]?.key ?? 'semua');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (key: string) => {
    setSelected(key);
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.setAttribute('aria-labelledby', tabId(key));
    Array.from(panel.children).forEach((cell, i) => {
      const show = key === 'semua' || (cardPositions[i] ?? []).includes(key);
      (cell as HTMLElement).hidden = !show;
    });
    // S5.2.1: 150 ms fade on change; instant under reduced motion and in the minimal motion tier (Save-Data).
    if (motionOn() && typeof panel.animate === 'function') {
      panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = tabs.length - 1;
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
  };

  return (
    <div className="iz-tabs iz-wrap iz-motor-tabs" role="tablist" aria-label="Posisi tas">
      {tabs.map((t, i) => {
        const on = t.key === selected;
        return (
          <button
            key={t.key}
            ref={el => {
              refs.current[i] = el;
            }}
            id={tabId(t.key)}
            className={`iz-fchip${on ? ' iz-fchip--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            onClick={() => select(t.key)}
            onKeyDown={e => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
