'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AffiliateTracker() {
  const searchParams = useSearchParams();
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    const aff = searchParams.get('aff');
    
    if (aff) {
      // Simpan parameter afiliate jika ada
      localStorage.setItem('inzta_affiliate', aff);
      
      // Cek apakah loading screen sudah pernah ditampilkan di sesi ini
      const hasSeenLoading = sessionStorage.getItem('inzta_aff_loading_seen');
      
      if (!hasSeenLoading) {
        setShowLoading(true);
        sessionStorage.setItem('inzta_aff_loading_seen', 'true');
        
        // Sembunyikan loading screen setelah 2.5 detik
        setTimeout(() => {
          setShowLoading(false);
        }, 2500);
      }
    }
  }, [searchParams]);

  if (!showLoading) return null;

  return (
    <div className="affiliate-loading-overlay">
      <div className="affiliate-loading-content">
        <h1 className="affiliate-loading-text">Berkendaralah yang jauh</h1>
        <div className="affiliate-loading-bar">
          <div className="affiliate-loading-progress"></div>
        </div>
      </div>
    </div>
  );
}
