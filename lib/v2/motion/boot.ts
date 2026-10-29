// Runs inline in <head> before the first paint (app/layout.tsx). On public v2 routes, with motion allowed, it adds
// html.iz-js and data-iz-curtain="load", which show the load curtain over the first paint (v2-motion.css). Admin,
// affiliate and API routes, reduced motion and visitors without JavaScript never see it. If the curtain is still down
// after BOOT_FALLBACK_MS (script error, a tab that paints no frames) the attribute is removed, so content is never left
// covered (F-016 C5).
export const BOOT_FALLBACK_MS = 6000;
export const CURTAIN_ATTR = 'data-iz-curtain';

// Same rule as isMotionRoute(), written for the inline script.
const SKIP = '^\\/(admin|affiliate|api)(\\/|$)';

export const bootScript = `(function(){try{var r=document.documentElement;if(new RegExp('${SKIP}').test(location.pathname))return;if(!window.matchMedia||matchMedia('(prefers-reduced-motion: reduce)').matches)return;r.classList.add('iz-js');r.setAttribute('${CURTAIN_ATTR}','load');setTimeout(function(){if(r.getAttribute('${CURTAIN_ATTR}')==='load')r.removeAttribute('${CURTAIN_ATTR}')},${BOOT_FALLBACK_MS})}catch(e){}})();`;

export function isMotionRoute(pathname: string): boolean {
  return !new RegExp(SKIP).test(pathname);
}
