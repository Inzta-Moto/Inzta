import Link from 'next/link';
import type { Product } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { toCard } from '@/lib/v2/home-data';
import Closing from '@/components/v2/Closing';
import ProductPdp from '@/components/v2/product/ProductPdp';
import SpecList from '@/components/v2/product/SpecList';
import FaqAccordion from '@/components/v2/product/FaqAccordion';
import RelatedProducts from '@/components/v2/product/RelatedProducts';
import DescriptionMore from '@/components/v2/product/DescriptionMore';
import { isSideProduct } from '@/components/v2/product/side';
import {
  crumbPosition,
  descriptionFolds,
  descriptionParagraphs,
  faqItems,
  featureTags,
  galleryImages,
  plainOrderHref,
  soldOutAtRender,
  specRows,
} from '@/components/v2/product/product-view';

function Description({ paragraphs }: { paragraphs: string[][] }) {
  return (
    <div className="iz-pdp-desc">
      <h2 className="t-h2-shop iz-pdp-h2">Deskripsi</h2>
      <DescriptionMore id="deskripsi-produk" folded={descriptionFolds(paragraphs)}>
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
      </DescriptionMore>
    </div>
  );
}

// Keyword entries of `features` (S3.5): a quiet chip row closing "what the product is", not a table with empty labels.
function FeatureTags({ tags }: { tags: string[] }) {
  return (
    <div className="iz-pdp-tags">
      <p className="iz-pdp-tags__title" id="kata-kunci-produk">Kata kunci</p>
      <ul className="iz-pdp-tags__list" aria-labelledby="kata-kunci-produk">
        {tags.map(t => (
          <li className="iz-cat-chip" key={t}>{t}</li>
        ))}
      </ul>
    </div>
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
  const tags = featureTags(product.features);
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

      {/* The details follow the gallery and buy box columns: what the product is (Spesifikasi, Deskripsi, then the
          keywords) under the gallery, the questions before ordering under the buy box. Spesifikasi shows only
          "Label: nilai" rows; with no text at all the questions take the first column (S3.5). */}
      <section className="iz-pdp-details iz-wrap iz-pdp-block" id="spesifikasi">
        {(rows.length > 0 || paragraphs.length > 0 || tags.length > 0) && (
          <div className="iz-pdp-info">
            {rows.length > 0 && (
              <div>
                <h2 className="t-h2-shop iz-pdp-h2">Spesifikasi</h2>
                <SpecList rows={rows} />
              </div>
            )}
            {paragraphs.length > 0 && <Description paragraphs={paragraphs} />}
            {tags.length > 0 && <FeatureTags tags={tags} />}
          </div>
        )}
        <div>
          <h2 className="t-h2-shop iz-pdp-h2">Pertanyaan sebelum memesan</h2>
          <FaqAccordion items={faq} />
        </div>
      </section>

      <RelatedProducts products={related} />

      <div className="iz-pdp-block">
        <Closing waHref={waHref} />
      </div>
    </>
  );
}
