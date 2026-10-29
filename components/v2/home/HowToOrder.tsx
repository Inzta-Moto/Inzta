import type { ComponentType, CSSProperties } from 'react';
import { BadgeCheck, Bag, Chat, Shield, Truck } from '@/components/v2/icons';
import HowToStage from '@/components/v2/home/HowToStage';
import StepScene, { type Scene } from '@/components/v2/home/HowToScenes';
import '@/app/(v2)/v2-howto.css';

const STEPS: readonly { icon: ComponentType; title: string; text: string; scene: Scene }[] = [
  { icon: Bag, title: 'Pilih tas', text: 'Buka halaman produk, pilih variasi dan jumlah.', scene: 'pick' },
  { icon: Chat, title: 'Klik Pesan via WhatsApp', text: 'Pesan berisi nama produk, jumlah, dan total sudah terisi.', scene: 'send' },
  { icon: BadgeCheck, title: 'Admin membalas', text: 'Admin INZTA mengonfirmasi ongkir dan pembayaran di WhatsApp.', scene: 'reply' },
];

// "Pesan dalam tiga langkah." (F-016 S1.10). Warranty and shipping time stay PLACEHOLDER until INZTA writes them
// (A-023, P-5, P-6; listed by check:f016-release, S1.10.3). S1.10.2: the v2 reset removes the list markers, so each
// number is announced once, from its visible numeral (the leading zero and the yellow fill copy are visual only); the
// road, node icons and scenes are aria-hidden. Motion: HowToStage (desktop: the section pins and scrolling walks the
// steps; phones: each step plays as it arrives). The Beranda sits it right under the previous section (paddingTop 0);
// /tentang keeps the normal section padding (S8.5.2).
export default function HowToOrder({ flush = true }: { flush?: boolean }) {
  return (
    <section className="iz-section" id="cara-pesan" style={flush ? { paddingTop: 0 } : undefined}>
      <div className="iz-wrap">
        <HowToStage className="iz-howto iz-howto--journey">
          <div className="iz-howto__intro">
            <div className="iz-howto__title">
              <span className="iz-eyebrow">Cara pesan</span>
              <h2 className="t-h2-landing">Pesan dalam tiga langkah.</h2>
            </div>
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
          <ol className="iz-journey">
            {STEPS.map(({ icon: Icon, title, text, scene }, i) => (
              <li key={title} className="iz-journey__step" style={{ '--i': i } as CSSProperties}>
                <div className="iz-journey__head">
                  <span className="iz-journey__n">
                    <span aria-hidden="true">0</span>
                    {i + 1}
                    <span className="iz-journey__nfill" aria-hidden="true">
                      0{i + 1}
                    </span>
                  </span>
                  <span className="iz-journey__node" aria-hidden="true">
                    <Icon />
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="iz-journey__road" aria-hidden="true">
                      <span className="iz-journey__fill" />
                    </span>
                  )}
                </div>
                <div className="iz-journey__card">
                  <div className="iz-journey__stage" aria-hidden="true">
                    <StepScene scene={scene} />
                  </div>
                  <div className="iz-journey__body">
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </HowToStage>
      </div>
    </section>
  );
}
