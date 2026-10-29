'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { generateCloudinarySrcSet, optimizeCloudinaryUrl } from '@/lib/utils';

type State = 'loading' | 'loaded' | 'error';

// Fixed-ratio image with a shimmer until it loads and a fallback tile when it fails (F-016 S0.12.2, S0.12.5).
// The <img> is in the server HTML, so without JavaScript the photo still shows; the shimmer layer is hidden by
// the noscript style in V2Page. Cloudinary sources get width-only transforms, which keep the aspect ratio the
// crop classes rely on (S0.9.5).
export default function SmartImage({
  src,
  alt,
  ratio,
  sizes,
  widths = [300, 600, 900],
  width = 600,
  tone = 'light',
  fallbackLabel,
  imgClassName,
  className,
  style,
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  ratio?: string;
  sizes?: string;
  widths?: number[];
  width?: number;
  tone?: 'light' | 'dark';
  fallbackLabel?: string;
  imgClassName?: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
}) {
  const [state, setState] = useState<State>(src ? 'loading' : 'error');
  const ref = useRef<HTMLImageElement>(null);

  // An image that finished before hydration fires no load event, so read its state once mounted.
  useEffect(() => {
    const img = ref.current;
    if (!img || !img.complete) return;
    setState(img.naturalWidth > 0 ? 'loaded' : 'error');
  }, []);

  const cloud = !!src && src.includes('res.cloudinary.com');
  const local = !!src && src.startsWith('/');
  const srcSet = cloud ? generateCloudinarySrcSet(src as string, widths) : '';
  const box: CSSProperties = { ...(ratio ? { aspectRatio: ratio } : {}), ...style };

  return (
    <span className={`iz-smartimg${tone === 'dark' ? ' iz-smartimg--dark' : ''}${className ? ` ${className}` : ''}`} style={box} data-state={state}>
      {local && state !== 'error' && (
        <Image
          ref={ref}
          className={imgClassName}
          src={src as string}
          alt={alt}
          fill
          sizes={sizes ?? '100vw'}
          priority={priority}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      )}
      {src && !local && state !== 'error' && (
        <img
          ref={ref}
          className={imgClassName}
          src={cloud ? optimizeCloudinaryUrl(src, width) : src}
          srcSet={srcSet || undefined}
          sizes={srcSet ? sizes : undefined}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // React 18 does not know fetchPriority yet and warns; the lowercase attribute passes through as-is.
          {...(priority ? { fetchpriority: 'high' } : {})}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      )}
      {/* The LCP image never shows the shimmer (S0.12.7). */}
      {!priority && state === 'loading' && <span className="iz-skel" aria-hidden="true" />}
      {state === 'error' && (
        <span className="iz-fallback" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
          <img className="iz-fallback__mark" src="/logo.png" alt="" aria-hidden="true" />
          {fallbackLabel && <span>{fallbackLabel}</span>}
        </span>
      )}
    </span>
  );
}
