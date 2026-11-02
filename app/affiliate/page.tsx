import { redirect } from 'next/navigation';

// RUL-02: the old client-SDK affiliate manager lived here. Rules already denied all its reads and writes,
// and it was the only caller of client sign-up. Affiliates are managed at /admin/affiliate; `/affiliate`
// stays a valid link for affiliates (middleware sends visitors without a session to /affiliate/login).
export default function AffiliateIndex() {
  redirect('/affiliate/dashboard');
}
