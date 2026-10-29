import { getAdminDb } from '@/lib/firebaseAdmin';
import { readPublic } from '@/lib/public-content';
import type { FlashSaleState } from '@/types';

const INACTIVE: FlashSaleState = { isActive: false, endsAt: null };

// Read in the Beranda's ISR render (F-016 24.2) so the promo bar is in the server HTML and never shifts the page.
// A missing document or a malformed one counts as inactive; read errors propagate like the other public reads,
// so a failed regeneration keeps the last good page.
export async function getFlashSale(): Promise<FlashSaleState> {
  return readPublic('flashSale', async () => {
    const doc = await getAdminDb().collection('settings').doc('flashSale').get();
    if (!doc.exists) return INACTIVE;
    const data = doc.data() ?? {};
    return {
      isActive: data.isActive === true,
      endsAt: typeof data.endsAt === 'string' ? data.endsAt : null,
    };
  }, INACTIVE);
}
