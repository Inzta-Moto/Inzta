import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKey.json' with { type: "json" };

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

async function check() {
  const snap = await db.collection('vouchers').get();
  console.log("Total vouchers:", snap.size);
  snap.forEach(doc => {
    console.log(doc.id, doc.data());
  });
  
  const affSnap = await db.collection('affiliates').get();
  console.log("Total affiliates:", affSnap.size);
  affSnap.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}

check().catch(console.error);
