import Link from 'next/link';
import type { Product } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { toCard } from '@/lib/v2/home-data';
import Closing from '@/components/v2/Closing';
import ProductPdp from '@/components/v2/product/ProductPdp';
import SpecList from '@/components/v2/product/SpecList';
import FaqAccordion from '@/components/v2/product/FaqAccordion';
import RelatedProducts from '@/components/v2/product/RelatedProducts';
import { isSideProduct } from '@/components/v2/product/side';
import {
  crumbPosition,
  descriptionParagraphs,
  faqItems,
  galleryImages,
  plainOrderHref,
  soldOutAtRender,
  specRows,
} from '@/components/v2/product/product-view';

function Description({ paragraphs }: { paragraphs: string[][] }) {
  return (
    <>
      <h2 className="t-h2-shop" style={{ marginBottom: 20 }}>
        Deskripsi
      </h2>
      {paragraphs.map((lines, i) => (
        <p className="t-body iz-muted iz-pdp-para" key={i}>
          {lines.map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

/**
 * Product page body (F-016 S3, S4), server-rendered from produk-detail.dc.html: breadcrumb, the client island with
 * gallery and buy box, specification, description, questions, related products, and the closing panel. Each block
 * carries `iz-wrap` itself because V2Layout owns <main> (the canvas puts `iz-wrap` on main).
 */
export default function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const card = toCard(product);
  const crumb = crumbPosition(product);
  const rows = specRows(product.features);
  const paragraphs = descriptionParagraphs(product.description);
  const faq = faqItems(product, rows);
  const side = isSideProduct(product);
  const waHref = `https://wa.me/${WA_NUMBER}`;
  // The island needs no long text; description and features stay in the server HTML only.
  const islandProduct = { ...product, description: '', features: [] } as Product;

  return (
    <>
      <nav className="iz-crumb iz-wrap iz-pdp-crumb" aria-label="Breadcrumb">
        <Link href="/">Beranda</Link>
        <span aria-hidden="true">/</span>
        <Link href="/produk">Produk</Link>
        {crumb && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={crumb.href}>{crumb.label}</Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <ProductPdp
        product={islandProduct}
        images={galleryImages(product, !side)}
        positionLabel={card.positionLabel}
        badge={card.badge}
        fit={card.fit}
        cropClass={card.cropClass}
        waHref={waHref}
        plainHref={plainOrderHref(product.name)}
        soldOut={soldOutAtRender(product)}
      />

      <section className="iz-grid-2 iz-wrap iz-pdp-block" id="spesifikasi" style={{ alignItems: 'start' }}>
        {rows.length > 0 ? (
          <>
            <div>
              <h2 className="t-h2-shop" style={{ marginBottom: 20 }}>
                Spesifikasi
              </h2>
              <SpecList rows={rows} />
            </div>
            <div>
              {paragraphs.length > 0 && <Description paragraphs={paragraphs} />}
              <div style={paragraphs.length > 0 ? { marginTop: 48 } : undefined}>
                <h2 className="t-h2-shop" style={{ marginBottom: 20 }}>
                  Pertanyaan sebelum memesan
                </h2>
                <FaqAccordion items={faq} />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* S3.5: without features the description and the questions take the columns. */}
            {paragraphs.length > 0 && (
              <div>
                <Description paragraphs={paragraphs} />
              </div>
            )}
            <div>
              <h2 className="t-h2-shop" style={{ marginBottom: 20 }}>
                Pertanyaan sebelum memesan
              </h2>
              <FaqAccordion items={faq} />
            </div>
          </>
        )}
      </section>

      <RelatedProducts products={related} />

      <div className="iz-pdp-block">
        <Closing waHref={waHref} />
      </div>
    </>
  );
}
