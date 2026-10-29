import type { HomeData } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { GASBER_SLUG } from '@/lib/v2/home-content';
import V2Page from '@/components/v2/V2Page';
import FlashBar from '@/components/v2/FlashBar';
import SiteNav from '@/components/v2/SiteNav';
import SiteFooter from '@/components/v2/SiteFooter';
import Garasi from '@/components/v2/Garasi';
import Hero from '@/components/v2/home/Hero';
import BestSeller from '@/components/v2/home/BestSeller';
import WhyInzta from '@/components/v2/home/WhyInzta';
import Positions from '@/components/v2/home/Positions';
import TourmaxBand from '@/components/v2/home/TourmaxBand';
import Community from '@/components/v2/home/Community';
import Guides from '@/components/v2/home/Guides';
import Reviews from '@/components/v2/home/Reviews';
import HowToOrder from '@/components/v2/home/HowToOrder';
import Closing from '@/components/v2/Closing';

// Beranda v2 "Rider's shop" (F-016), section order of Main.dc.html (requirement 1.1).
export default function HomeV2({ data }: { data: HomeData }) {
  const waHref = `https://wa.me/${WA_NUMBER}`;
  const gasberHref = data.gasberPublished ? `/blog/${GASBER_SLUG}` : '/blog';
  return (
    <V2Page>
      <FlashBar flash={data.flash} />
      <SiteNav minPrices={data.minPrices} waHref={waHref} />
      <main id="isi">
        <Hero />
        <Garasi />
        <BestSeller cards={data.bestSellers} flash={data.flash} />
        <WhyInzta gasberHref={gasberHref} waHref={waHref} />
        <Positions minPrices={data.minPrices} />
        <TourmaxBand tourmax={data.tourmax} />
        <Community gasberHref={gasberHref} />
        <Guides guides={data.guides} />
        <Reviews productImages={data.productImages} />
        <HowToOrder />
        <Closing waHref={waHref} />
      </main>
      <SiteFooter waHref={waHref} waNumber={WA_NUMBER} />
    </V2Page>
  );
}
