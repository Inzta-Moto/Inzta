import SmartImage from '@/components/v2/ui/SmartImage';

// Photo cell of v2 article cards (F-016 S6.3, S6.4, S7.6). The ratio comes from the parent card rule
// (.iz-afeature 4:3, .iz-acard 16:10, .iz-grow 1:1), so the box is reserved before the image loads.
// alt="" because the title in the same link names the card (S6.3.2, S6.4.1, S7.6.2).
export default function ArticlePhoto({
  photo,
  caption,
  sizes,
  widths,
  width,
  priority = false,
}: {
  photo: string | null;
  caption?: string | null;
  sizes: string;
  widths: number[];
  width: number;
  priority?: boolean;
}) {
  // P-2: no cover in admin yet. Real covers never carry "Foto contoh" (S6.4.3).
  if (!photo) {
    return (
      <div className="iz-photo iz-photo--empty iz-aphoto">
        <span className="iz-for iz-placeholder">Foto belum tersedia</span>
      </div>
    );
  }
  return (
    <div className="iz-photo iz-aphoto">
      <SmartImage src={photo} alt="" sizes={sizes} widths={widths} width={width} priority={priority} />
      {/* S6.3.3: organiser photos carry their credit (CONTENT.md); decorative like the photo itself. */}
      {caption && <span className="iz-tag" aria-hidden="true">{caption}</span>}
    </div>
  );
}
