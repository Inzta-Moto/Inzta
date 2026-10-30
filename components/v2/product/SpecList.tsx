import type { SpecRow } from '@/components/v2/product/product-view';

// Specification list `dl.iz-spec` (F-016 S3.5). Entries without "Label:" keep an empty label column.
export default function SpecList({ rows }: { rows: SpecRow[] }) {
  return (
    <dl className="iz-spec">
      {rows.map((r, i) => (
        <div key={`${i}-${r.label}-${r.value}`}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
