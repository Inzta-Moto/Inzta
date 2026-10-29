import HowToOrder from '@/components/v2/home/HowToOrder';
import PageMotion from '@/components/v2/motion/PageMotion';
import AboutHero from '@/components/v2/about/AboutHero';
import ProcessSteps from '@/components/v2/about/ProcessSteps';
import ValuesList from '@/components/v2/about/ValuesList';
import CommunityPanel from '@/components/v2/about/CommunityPanel';
import ContactCard from '@/components/v2/about/ContactCard';
import { SHOW_VALUES_COPY } from '@/components/v2/about/about-content';

// Tentang (F-016 S8), section order of tentang.dc.html. Server component: every text is in the server HTML
// (S8.7.1). No closing panel, matching the canvas (S0.8).
export default function About({ gasberHref }: { gasberHref: string }) {
  return (
    <>
      <AboutHero />
      <ProcessSteps />
      {SHOW_VALUES_COPY && <ValuesList gasberHref={gasberHref} />}
      <CommunityPanel gasberHref={gasberHref} />
      <HowToOrder flush={false} />
      <ContactCard />
      <PageMotion page="about" />
    </>
  );
}
