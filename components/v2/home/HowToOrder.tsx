import type { ComponentType } from 'react';
import { BadgeCheck, Bag, Chat, Shield, Truck } from '@/components/v2/icons';

const STEPS: readonly { icon: ComponentType; title: string; text: string }[] = [
  { icon: Bag, title: 'Pilih tas', text: 'Buka halaman produk, pilih variasi dan jumlah.' },
  { icon: Chat, title: 'Klik Pesan via WhatsApp', text: 'Pesan berisi nama produk, jumlah, dan total sudah terisi.' },
  { icon: BadgeCheck, title: 'Admin membalas', text: 'Admin INZTA mengonfirmasi ongkir dan pembayaran di WhatsApp.' },
];

// "Pesan dalam tiga langkah." (F-016 14). Warranty and shipping time stay PLACEHOLDER until INZTA writes them (A-023, P-5, P-6).
export default function HowToOrder() {
  return (
    <section className="iz-section" id="cara-pesan" style={{ paddingTop: 0 }}>
      <div className="iz-wrap">
        <div className="iz-howto">
          <div className="iz-howto__intro">
            <span className="iz-eyebrow">Cara pesan</span>
            <h2 className="t-h2-landing">Pesan dalam tiga langkah.</h2>
            <div className="iz-infopills">
              <span className="iz-infopill">
                <Shield />
                Garansi: PLACEHOLDER
              </span>
              <span className="iz-infopill">
                <Truck />
                Waktu kirim: PLACEHOLDER
              </span>
            </div>
          </div>
          <ol className="iz-ordersteps">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <div className="iz-ordersteps__top">
                  <span className="iz-ordersteps__n">{i + 1}</span>
                  <span className="iz-ordersteps__icon">
                    <Icon />
                  </span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
