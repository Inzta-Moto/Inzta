'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { ArticleTopic } from '@/types';
import { topicLabel } from '@/lib/v2/article-v2';

export type TopicTab = 'semua' | ArticleTopic;

export const tabId = (t: TopicTab) => `topik-tab-${t}`;

// Topic tabs (F-016 S6.2.1, blog.dc.html:30-36): WAI-ARIA tabs with a roving tabindex; ArrowLeft/ArrowRight move and
// select, Home/End go to the ends. Without JavaScript the buttons are inert and "Semua" stays selected (ST-NOJS).
export default function TopicTabs({
  tabs,
  selected,
  panelId,
  onSelect,
}: {
  tabs: TopicTab[];
  selected: TopicTab;
  panelId: string;
  onSelect: (t: TopicTab) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = tabs.length - 1;
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1;
    if (next === -1) return;
    e.preventDefault();
    onSelect(tabs[next]);
    refs.current[next]?.focus();
  }

  return (
    <div className="iz-tabs iz-atabs" role="tablist" aria-label="Topik">
      {tabs.map((t, i) => {
        const active = t === selected;
        return (
          <button
            key={t}
            ref={el => { refs.current[i] = el; }}
            id={tabId(t)}
            className={`iz-fchip${active ? ' iz-fchip--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(t)}
            onKeyDown={e => onKeyDown(e, i)}
          >
            {t === 'semua' ? 'Semua' : topicLabel(t)}
          </button>
        );
      })}
    </div>
  );
}
