'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ArticleCardV2, ArticleTopic } from '@/types';
import { ARTICLE_TOPICS } from '@/lib/v2/article-v2';
import TopicTabs, { tabId, type TopicTab } from './TopicTabs';
import FeaturedArticle from './FeaturedArticle';
import ArticleCardItem from './ArticleCardV2';
import CategoryPanel from './CategoryPanel';
import Pager from './Pager';

const PANEL_ID = 'artikel-daftar';
// S6.5.1: the featured card plus at most six cards per page (seven articles, as the canvas).
export const CARDS_PER_PAGE = 6;
// S6.4.2: the category panel needs four cards on the page and sits after the third.
const PANEL_MIN_CARDS = 4;
const PANEL_AFTER = 3;

// S6.2.4: replaceState keeps Next's history state and adds no entry; other query keys (?aff=) and the hash stay.
function writeTopik(t: ArticleTopic | null) {
  const url = new URL(window.location.href);
  if (t) url.searchParams.set('topik', t);
  else url.searchParams.delete('topik');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Article list of /blog (F-016 S6.2-S6.6). The server HTML is the "Semua" state with every article visible and no
 * pager, which is also the no-JS state (S6.2.6, S6.5.2). The query is read only after mount from window.location,
 * never through searchParams or useSearchParams, so the page stays ISR. Receives card fields only (S6.7.2).
 */
export default function ArticleList({ cards }: { cards: ArticleCardV2[] }) {
  // S6.2.3: a topic with no article gets no tab; with no topic at all there is no tab list.
  const topics = useMemo(() => ARTICLE_TOPICS.filter(t => cards.some(c => c.topik === t)), [cards]);
  const tabs: TopicTab[] = topics.length ? ['semua', ...topics] : [];
  const [tab, setTab] = useState<TopicTab>('semua');
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const [changes, setChanges] = useState(0);
  const focusPending = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // S6.2.5: a deep link to a rendered tab selects it; an unknown or empty topic falls back to "Semua".
  useEffect(() => {
    setReady(true);
    const q = new URLSearchParams(window.location.search).get('topik');
    if (q === null) return;
    const known = topics.find(t => t === q);
    if (known) setTab(known);
    else writeTopik(null);
    // Runs once after hydration; later changes go through select().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = tab === 'semua' ? cards : cards.filter(c => c.topik === tab);
  const [featured, ...rest] = list;
  const pages = Math.max(1, Math.ceil(rest.length / CARDS_PER_PAGE));
  const current = Math.min(page, pages);
  const start = ready ? (current - 1) * CARDS_PER_PAGE : 0;
  const end = ready ? start + CARDS_PER_PAGE : rest.length;
  const showPanel = Math.min(end, rest.length) - start >= PANEL_MIN_CARDS;
  // Index in `rest` after which the panel sits; cards of other pages stay in the DOM with `hidden`.
  const split = showPanel ? start + PANEL_AFTER : rest.length;
  const before = rest.slice(0, split);
  const after = rest.slice(split);
  const isHidden = (i: number) => i < start || i >= end;

  // S6.5.4: after a page change, focus goes to the first card link of the new page.
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    panelRef.current?.querySelector<HTMLElement>('.iz-acard:not([hidden])')?.focus();
  }, [current]);

  function select(t: TopicTab) {
    if (t === tab) return;
    setTab(t);
    setPage(1);
    setChanges(n => n + 1);
    writeTopik(t === 'semua' ? null : t);
  }

  function goTo(n: number) {
    focusPending.current = true;
    setPage(n);
  }

  if (!featured) return null;
  const hasTabs = tabs.length > 0;

  return (
    <>
      {hasTabs && <TopicTabs tabs={tabs} selected={tab} panelId={PANEL_ID} onSelect={select} />}
      <div
        ref={panelRef}
        id={PANEL_ID}
        key={changes}
        className={`iz-alist${changes > 0 ? ' iz-alist--fade' : ''}`}
        role={hasTabs ? 'tabpanel' : undefined}
        aria-labelledby={hasTabs ? tabId(tab) : undefined}
      >
        <FeaturedArticle card={featured} />
        {before.length > 0 && (
          <section style={{ marginTop: 56 }}>
            <div className="iz-grid-3">
              {before.map((c, i) => <ArticleCardItem key={c.slug} card={c} hidden={isHidden(i)} />)}
            </div>
            {after.length === 0 && ready && pages > 1 && <Pager page={current} pages={pages} onPage={goTo} />}
          </section>
        )}
        {showPanel && <CategoryPanel />}
        {after.length > 0 && (
          <section style={{ marginTop: 56 }}>
            <div className="iz-grid-3">
              {after.map((c, i) => <ArticleCardItem key={c.slug} card={c} hidden={isHidden(split + i)} />)}
            </div>
            {ready && pages > 1 && <Pager page={current} pages={pages} onPage={goTo} />}
          </section>
        )}
      </div>
    </>
  );
}
