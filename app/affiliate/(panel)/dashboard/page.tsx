import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isSessionError, toMillis, type AffCommission, type AffCommissionItem, type AffVoucher } from '@/lib/affiliate/dashboard';
import AffiliateDashboardClient from './AffiliateDashboardClient';

export const dynamic = 'force-dynamic';

type DashboardData = { affiliateName: string; ownVoucherCode: string; voucher: AffVoucher; commissions: AffCommission[] };

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Drops undefined keys, so the client payload only carries fields the document actually has. */
function compact<T extends Record<string, unknown>>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}

// F-023 E15: only the fields the dashboard shows cross into the client, never the whole Firestore document (the
// commission and voucher documents carry admin-side fields the affiliate has no use for).
function toCommission(id: string, d: Record<string, unknown>): AffCommission {
  const items = Array.isArray(d.items)
    ? d.items.map((raw): AffCommissionItem => {
        const it = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        return compact({ productName: str(it.productName), name: str(it.name), selectedVariantLabel: str(it.selectedVariantLabel), quantity: num(it.quantity) });
      })
    : undefined;
  return compact({
    id,
    productName: str(d.productName),
    items,
    productPrice: num(d.productPrice),
    commissionAmount: num(d.commissionAmount),
    isPaid: d.isPaid === true,
    paidAt: toMillis(d.paidAt),
    createdAt: toMillis(d.createdAt),
    orderId: str(d.orderId),
  });
}

function toVoucher(d: Record<string, unknown>): NonNullable<AffVoucher> {
  return compact({
    code: str(d.code),
    type: str(d.type),
    value: num(d.value),
    maxDiscount: num(d.maxDiscount),
    // Same truthiness as the old `!voucherData.isActive` check.
    isActive: Boolean(d.isActive),
    expiresAt: toMillis(d.expiresAt),
  });
}

/** The three reads the dashboard has always made (Spark quota, F-023 brief). Null when no affiliate has this uid. */
async function loadDashboard(uid: string): Promise<DashboardData | null> {
  const db = getAdminDb();
  // RUL-02 / FB-01: match by uid only. The old email fallback trusted unverified emails and rewrote
  // the document's uid, so any account with that email could take over the dashboard.
  const affSnap = await db.collection('affiliates').where('uid', '==', uid).limit(1).get();
  if (affSnap.empty) return null;

  const affiliateDoc = affSnap.docs[0];
  const affiliateData = affiliateDoc.data();
  const ownVoucherCode = typeof affiliateData.voucherCode === 'string' ? affiliateData.voucherCode : '';

  const commSnap = await db.collection('commissions').where('affiliateId', '==', affiliateDoc.id).get();
  const commissions = commSnap.docs
    .map(doc => toCommission(doc.id, doc.data()))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  let voucher: AffVoucher = null;
  if (ownVoucherCode) {
    const voucherSnap = await db.collection('vouchers').doc(ownVoucherCode).get();
    if (voucherSnap.exists) voucher = toVoucher(voucherSnap.data() ?? {});
  }

  const name = typeof affiliateData.name === 'string' ? affiliateData.name.trim() : '';
  return { affiliateName: name || 'Afiliasi', ownVoucherCode, voucher, commissions };
}

/** Error code only: messages and stacks can carry document paths, and the log must not hold affiliate data. */
function errorCode(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; name?: unknown };
    if (typeof e.code === 'string' || typeof e.code === 'number') return String(e.code);
    if (typeof e.name === 'string') return e.name;
  }
  return 'unknown';
}

// F-023 E16: a missing or invalid session, or a uid without an affiliate document, goes back to the login page as
// before (F-017). Any other failure (Firestore, network, Admin SDK setup) is thrown to error.tsx, so a failed read
// no longer looks like a logout. redirect() throws NEXT_REDIRECT, so it is never called inside a try that would
// swallow it.
export default async function AffiliateDashboardPage() {
  const sessionCookie = cookies().get('affiliate_session')?.value;
  if (!sessionCookie) redirect('/affiliate/login');

  let uid: string;
  try {
    uid = (await getAdminAuth().verifySessionCookie(sessionCookie, true)).uid;
  } catch (err) {
    if (isSessionError(err)) redirect('/affiliate/login');
    console.error('[affiliate/dashboard] session check failed:', errorCode(err));
    throw err;
  }

  let data: DashboardData | null;
  try {
    data = await loadDashboard(uid);
  } catch (err) {
    console.error('[affiliate/dashboard] data load failed:', errorCode(err));
    throw err;
  }
  if (!data) redirect('/affiliate/login');

  return (
    <AffiliateDashboardClient
      affiliateName={data.affiliateName}
      ownVoucherCode={data.ownVoucherCode}
      voucher={data.voucher}
      commissions={data.commissions}
      now={Date.now()}
    />
  );
}
