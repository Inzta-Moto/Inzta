import { OVERRIDE_KEY, PROBE_KEY, PROBE_TTL_MS, SLOW_NETWORKS, TIER_ATTR } from '@/lib/v2/motion/tier';

// Runs inline in <head> before the first paint (app/layout.tsx). On public v2 routes it picks the motion tier and writes
// it to html[data-iz-tier] (lib/v2/motion/tier.ts decideTier(), mirrored here because this runs before any bundle;
// tests/f016-motion.cjs runs both over the same signals). Above the minimal tier it adds html.iz-js and
// data-iz-curtain="load", which show the load curtain over the first paint (v2-motion.css). Admin, affiliate and API
// routes, the minimal tier (reduced motion, Save-Data) and visitors without JavaScript never see it. If the curtain is
// still down after BOOT_FALLBACK_MS (script error, a tab that paints no frames) the attribute is removed, so content is
// never left covered (F-016 C5). Storage can throw (private mode, blocked site data), so every access is guarded, and
// a ?motion= in the URL wins over storage, so the override holds for the page it is on even when it cannot be stored.
// hardwareConcurrency only counts next to deviceMemory: Safari caps the core count it reports (iPhones report 4 or
// less whatever the chip), and Chromium, the only family with deviceMemory, reports the real count.
export const BOOT_FALLBACK_MS = 6000;
export const CURTAIN_ATTR = 'data-iz-curtain';

// Same rule as isMotionRoute(), written for the inline script.
const SKIP = '^\\/(admin|affiliate|api)(\\/|$)';

const TIER_JS = [
  `var w=window,n=navigator,c=n.connection||{},ls=null;`,
  `try{ls=w.localStorage}catch(e){}`,
  `var get=function(k){try{return ls?ls.getItem(k):null}catch(e){return null}};`,
  `var put=function(k,v){try{if(ls){if(v===null)ls.removeItem(k);else ls.setItem(k,v)}}catch(e){}};`,
  `var reduced=!w.matchMedia||w.matchMedia('(prefers-reduced-motion: reduce)').matches;`,
  `var q=/[?&]motion=(full|lite|minimal|auto)(?:&|$)/.exec(location.search);`,
  `if(q)put('${OVERRIDE_KEY}',q[1]==='auto'?null:q[1]);`,
  `var o=q?(q[1]==='auto'?null:q[1]):get('${OVERRIDE_KEY}');if(!/^(full|lite|minimal)$/.test(o||''))o=null;`,
  `var p=/^lite:(\\d+)$/.exec(get('${PROBE_KEY}')||''),probe=false;`,
  `if(p){var age=Date.now()-Number(p[1]);if(age>=0&&age<${PROBE_TTL_MS})probe=true;else put('${PROBE_KEY}',null)}`,
  `var dm=n.deviceMemory,hc=n.hardwareConcurrency;`,
  `var hint=(typeof dm==='number'&&dm>0&&dm<=4)||(typeof dm==='number'&&typeof hc==='number'&&hc>0&&hc<=4)||${JSON.stringify(SLOW_NETWORKS).replace(/"/g, "'")}.indexOf(c.effectiveType)>=0;`,
  `var t=reduced?'minimal':o?o:c.saveData?'minimal':probe?'lite':hint?'lite':'full';`,
  `r.setAttribute('${TIER_ATTR}',t);`,
].join('');

export const bootScript = `(function(){try{var r=document.documentElement;if(new RegExp('${SKIP}').test(location.pathname))return;r.classList.add('iz-v2');${TIER_JS}if(t==='minimal')return;r.classList.add('iz-js');r.setAttribute('${CURTAIN_ATTR}','load');setTimeout(function(){if(r.getAttribute('${CURTAIN_ATTR}')==='load')r.removeAttribute('${CURTAIN_ATTR}')},${BOOT_FALLBACK_MS})}catch(e){}})();`;

export function isMotionRoute(pathname: string): boolean {
  return !new RegExp(SKIP).test(pathname);
}
