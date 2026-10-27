'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  { q: 'Apakah tas ini benar-benar 100% waterproof?', a: 'Ya, semua tas INZTA menggunakan material PVC/TPU premium dengan sealed zipper yang menahan air 100% bahkan dalam hujan lebat.' },
  { q: 'Apakah bisa dipasang di semua jenis motor?', a: 'Bisa! Tas kami dilengkapi dengan sabuk universal adjustable yang bisa dipasang di bagian belakang motor (tail), side, maupun tangki.' },
  { q: 'Bagaimana cara merawat tas INZTA?', a: 'Cukup lap dengan kain basah setelah digunakan di bawah hujan, lalu keringkan di tempat teduh. Hindari mencuci menggunakan mesin cuci.' },
  { q: 'Berapa lama garansi produknya?', a: 'Kami memberikan garansi resmi 2 bulan untuk cacat produksi (resleting rusak, jahitan lepas, dll).' },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="section faq-section" style={{ scrollMarginTop: 64 }}>
      <div className="container">
        <div className="section-header">
          <p className="section-eyebrow">FAQ</p>
          <h2 className="section-title">Pertanyaan Umum</h2>
        </div>
        <div className="faq-list">
          {faqs.map((faq, i) => (
            <div key={i} className={`faq-item ${openIndex === i ? 'open' : ''}`}>
              <button className="faq-question" onClick={() => setOpenIndex(openIndex === i ? null : i)}>
                <span>{faq.q}</span>
                <ChevronDown size={18} className="faq-chevron" />
              </button>
              <div className="faq-answer">
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}