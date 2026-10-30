import { formatShortDate } from '@/lib/v2/home-data';

// "<author> · <tanggal>" in the short form "26 Okt 2026" (F-016 S6.3, S6.4.3); without a date, the author only.
export default function ArticleMeta({ author, date }: { author: string; date: number | null }) {
  return (
    <span className="iz-meta">
      {author}
      {date !== null && (
        <>
          {' · '}
          <time dateTime={new Date(date).toISOString()}>{formatShortDate(date)}</time>
        </>
      )}
    </span>
  );
}
