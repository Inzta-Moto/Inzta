import { serializeJsonLd } from '@/lib/seo';

// F-005: the only place that writes a JSON-LD block, so every block goes through the escaping serializer.
export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
