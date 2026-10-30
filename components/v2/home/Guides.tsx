import Link from 'next/link';
import type { HomeGuideCard } from '@/types';
import { formatShortDate, guideAction } from '@/lib/v2/home-data';
import SmartImage from '@/components/v2/ui/SmartImage';
import { ArrowRight } from '@/components/v2/icons';

// Article without a cover: the "Foto belum tersedia" tile (S1.8.3, P-2/P-14). Real covers never get "Foto contoh".
function EmptyPhoto() {
  return (
    <div className="iz-photo iz-photo--empty">
      <span className="iz-for iz-placeholder">Foto belum tersedia</span>
    </div>
  );
}

// The title text sits in its own span so the hover underline can follow every line of a wrapped title (S1.8.5).
function Title({ text }: { text: string }) {
  return (
    <h3>
      <span className="iz-uline">{text}</span>
    </h3>
  );
}

// Featured card on a dark surface, so the cover uses the dark tone (S0.12.5). Images get alt="" because the h3 in the
// same link names the article (S0.12.6). The credit tag is the one-line cover caption (S1.8.3); it is aria-hidden so
// the link name stays the title. The action text is part of the link, not a second link (S1.8.1).
function Feature({ guide, wide }: { guide: HomeGuideCard; wide: boolean }) {
  return (
    <Link className="iz-gfeature" href={`/blog/${guide.slug}`}>
      {guide.image ? (
        <SmartImage
          src={guide.image}
          alt=""
          tone="dark"
          sizes={wide ? '(max-width: 1280px) 100vw, 1200px' : '(max-width: 767px) 100vw, 58vw'}
          widths={[480, 800, 1200]}
          width={1200}
        />
      ) : (
        <EmptyPhoto />
      )}
      {guide.credit && (
        <span className="iz-tag" aria-hidden="true">
          {guide.credit}
        </span>
      )}
      {guide.chip && <span className="iz-cat-chip">{guide.chip}</span>}
      <Title text={guide.title} />
      <div className="iz-gmeta">
        <span>
          {guide.author}
          {guide.date !== null && (
            <>
              {' · '}
              <span className="iz-nowrap">{formatShortDate(guide.date)}</span>
            </>
          )}
        </span>
        <span className="iz-link">
          {guideAction(guide)} <ArrowRight size={18} />
        </span>
      </div>
    </Link>
  );
}

// Side cards keep the canvas: 176 px thumbnail, chip, title, "Baca panduan", no author or date (S1.8, S1.8.1).
function Row({ guide }: { guide: HomeGuideCard }) {
  return (
    <Link className="iz-grow" href={`/blog/${guide.slug}`}>
      {guide.image ? (
        <div className="iz-photo">
          <SmartImage src={guide.image} alt="" sizes="176px" widths={[176, 352, 528]} width={352} />
          {guide.credit && (
            <span className="iz-tag" aria-hidden="true">
              {guide.credit}
            </span>
          )}
        </div>
      ) : (
        <EmptyPhoto />
      )}
      <div className="iz-grow__body">
        {guide.chip && <span className="iz-cat-chip">{guide.chip}</span>}
        <Title text={guide.title} />
        <span className="iz-link">
          Baca panduan <ArrowRight size={18} />
        </span>
      </div>
    </Link>
  );
}

// "Sebelum memilih, baca ini dulu." (F-016 S1.8). Layout by count (S1.8.2): 0 → no section; 1 → featured at full
// width; 2 → featured plus one side card, no empty slot; 3 or more → featured plus two side cards. A failed article
// read arrives here as an empty list (readHomeSources, S1.8.4).
export default function Guides({ guides }: { guides: HomeGuideCard[] }) {
  if (guides.length === 0) return null;
  const [first, ...rest] = guides;
  const side = rest.slice(0, 2);
  return (
    <section className="iz-section">
      <div className="iz-wrap">
        <div className="iz-head iz-head--split">
          <div>
            <span className="iz-eyebrow">Panduan rider</span>
            <h2 className="t-h2-landing">Sebelum memilih, baca ini dulu.</h2>
          </div>
          <Link className="iz-link" href="/blog">
            Semua artikel <ArrowRight size={18} />
          </Link>
        </div>
        <div className={side.length === 0 ? 'iz-guides iz-guides--single' : 'iz-guides'} data-count={guides.length >= 3 ? 3 : guides.length} data-reveal-stagger="">
          <Feature guide={first} wide={side.length === 0} />
          {side.length > 0 && (
            <div className="iz-guides__side">
              {side.map(g => (
                <Row key={g.slug} guide={g} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
