'use client';

import { useState } from 'react';
import { Camera, X } from 'lucide-react';

const galleryImages = [
  { src: 'https://i.ytimg.com/vi/hrJnT58v8Ss/hq720.jpg?sqp=-oaymwE7CK4FEIIDSFryq4qpAy0IARUAAAAAGAElAADIQj0AgKJD8AEB-AH-CYAC0AWKAgwIABABGFQgXihlMA8=&rs=AOn4CLBjwCeRL8haREKtJ3qI5BUFZG6LcQ', alt: 'Motor di jalan raya' },
  { src: 'https://images.tokopedia.net/img/cache/700/aphluv/1997/1/1/1a822a8a187f4411baf5e432371fa08c~.jpeg', alt: 'Masukan Barang ke dalam tas' },
  { src: 'https://static.indo4ward.com/images/product/d15fab068342834bb906233ffbdf5c6c/ecef125c0d5e8e196da1be1ec0904acf_t', alt: 'Prepare Touring' },
  { src: 'https://down-id.img.susercontent.com/file/id-11134207-7r98x-lsd01sx4skwped', alt: 'Pemasangan Tas' },
  { src: 'https://static.indo4ward.com/images/product/8338e90cff30f5bbea5825eb12e32de4/41a50ef2d8c3d7d313cb96a7f6eed358_t', alt: 'Parkir motor' },
  { src: 'https://images.tokopedia.net/img/cache/700/aphluv/1997/1/1/3e2473ce6b7c416290e9fffa5b1b708c~.jpeg', alt: 'Parkir motor aesthetic' },
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
              <img src={img.src} alt={img.alt} loading="lazy" />
              <div className="gallery-overlay"><Camera size={24} /></div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="gallery-lightbox" onClick={() => setSelected(null)}>
          <button className="lightbox-close" onClick={() => setSelected(null)}><X size={24} /></button>
          <img src={selected.src} alt={selected.alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </section>
  );
}