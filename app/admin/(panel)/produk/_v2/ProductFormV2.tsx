'use client';

import SidePresetCard from './SidePresetCard';
import KategoriMotorField from './KategoriMotorField';
import type { ProductFormV2Api } from './useProductFormV2';

// The one mount point of the F-016 S4.6 additions inside app/admin/(panel)/produk/page.tsx.
export default function ProductFormV2({ v2, name, slug }: { v2: ProductFormV2Api; name: string; slug: string }) {
  return (
    <>
      <SidePresetCard v2={v2} name={name} slug={slug} />
      <KategoriMotorField v2={v2} />
    </>
  );
}

export { useProductFormV2 } from './useProductFormV2';
