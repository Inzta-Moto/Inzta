import { Quote } from 'lucide-react';

const reviews = [
  { name: 'Andi R.', bike: 'Honda CB650R', text: 'Kualitas bahan top banget! Dipakai hujan deras pun dalam tas tetap kering. Worth every penny.' },
  { name: 'Siska M.', bike: 'Yamaha NMAX', text: 'Desainnya minimalis dan gah, nggak merusap estetika motor. Plus pemasangannya super mudah.' },
  { name: 'Budi P.', bike: 'Kawasaki Ninja 400', text: 'Pernah jatuh motor, tapi tasnya kuat banget. Isi di dalam aman sentosa. Recommended!' },
];

export default function Testimonials() {
  return (
    <section className="section testimonials-section">
      <div className="container">
        <div className="section-header">
          <p className="section-eyebrow">Testimoni</p>
          <h2 className="section-title">Kata Mereka</h2>
        </div>
        <div className="testimonials-grid">
          {reviews.map((r, i) => (
            <div key={i} className="testimonial-card">
              <div className="testimonial-icon"><Quote size={20} /></div>
              <p className="testimonial-text">{r.text}</p>
              <div className="testimonial-author">
                <strong>{r.name}</strong>
                <span>{r.bike}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}