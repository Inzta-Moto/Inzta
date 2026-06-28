'use client';

import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { optimizeCloudinaryUrl, generateCloudinarySrcSet } from '@/lib/utils';

const galleryImages = [
  { src: 'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780326022/99_u0fbp7.jpg', alt: 'Pap Touring With BUBUB' },
  { src: 'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780324954/01_rmqx6d.jpg', alt: 'Style Gaya Inzta' },
 { src: 'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780325195/04_avqwtg.jpg', alt: 'Senja' },
  { src: 'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780333698/03_iwohfu.jpg', alt: 'Motor di jalan raya' },
  { src: 'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780333699/09_suhe7q.jpg', alt: 'image inzta' },
  { src: 'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780324953/02_dctvpe.jpg', alt: 'Pap Touring With BUBUB' },
];

export default function Gallery() {
  const [selected, setSelected] = useState<typeof galleryImages[0] | null>(null);

  return (
    <section className="section gallery-section">
      <div className="container">
        <div className="section-header">
          <p className="section-eyebrow">Gallery</p>
          <h2 className="section-title">On The Road</h2>
          <p className="section-desc">Potret Rider menggunakan tas INZTA di berbagai medan.</p>
        </div>
        <div className="gallery-grid">
          {galleryImages.map((img, i) => (
            <div key={i} className="gallery-item" onClick={() => setSelected(img)}>
              <img 
                src={optimizeCloudinaryUrl(img.src, 600)} 
                srcSet={generateCloudinarySrcSet(img.src, [400, 600, 800])}
                sizes="(max-width: 768px) 50vw, 33vw"
                alt={img.alt} 
                loading="lazy" 
              />
              <div className="gallery-overlay"><Camera size={24} /></div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="gallery-lightbox" onClick={() => setSelected(null)}>
          <button className="lightbox-close" onClick={() => setSelected(null)}><X size={24} /></button>
          <img 
            src={optimizeCloudinaryUrl(selected.src, 1920)} 
            srcSet={generateCloudinarySrcSet(selected.src, [800, 1200, 1920])}
            sizes="100vw"
            alt={selected.alt} 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </section>
  );
}
