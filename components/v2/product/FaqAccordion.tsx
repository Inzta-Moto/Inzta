import type { FaqItem } from '@/components/v2/product/product-view';
import { AccPlusIcon } from '@/components/v2/product/product-icons';

// Accordion `.iz-acc` with native <details>, so it works without JavaScript; the first item is open (F-016 S3.7.1).
export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="iz-acc">
      {items.map((item, i) => (
        <details key={item.q} open={i === 0}>
          <summary>
            {item.q}
            <span className="iz-acc__plus">
              <AccPlusIcon />
            </span>
          </summary>
          <div className="iz-acc__body">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
