// Page numbers to show (F-016 S6.5.3): all of them up to seven pages; beyond that 1, …, current − 1, current,
// current + 1, …, last. 'gap' renders as an aria-hidden ellipsis.
export function pageItems(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = [1, current - 1, current, current + 1, total].filter((n, i, a) => n >= 1 && n <= total && a.indexOf(n) === i).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  keep.forEach((n, i) => {
    if (i > 0 && n - keep[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

// Pager of the article list (F-016 S6.5, blog.dc.html:76). Rendered only after hydration and only with two or more
// pages, so without JavaScript every article stays visible and no dead control is shown (S6.5.2).
export default function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  return (
    <nav className="iz-pager" aria-label="Halaman artikel">
      <button type="button" disabled={page === 1} onClick={() => onPage(page - 1)}>Sebelumnya</button>
      {pageItems(page, pages).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className="iz-pager__gap" aria-hidden="true">…</span>
        ) : (
          <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>
            {n}
          </button>
        ),
      )}
      <button type="button" disabled={page === pages} onClick={() => onPage(page + 1)}>Berikutnya</button>
    </nav>
  );
}
