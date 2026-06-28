import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function LoadingProductDetail() {
  return (
    <>
      <Header active="produk" />

      <section className="detail-page-header">
        <div className="container">
          <div className="breadcrumb-wrapper" style={{ display: 'flex', alignItems: 'center', height: '18px' }}>
            <div className="skeleton-box" style={{ width: 180, height: 16, borderRadius: 4 }} />
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="container">
          <div className="detail-grid">
            
            {/* Image Skeleton */}
            <div className="detail-image-section">
              <div className="skeleton-box" style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 12, overflow: 'hidden' }}>
                <div className="skeleton-box" style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0 }} />
                <div className="skeleton-box" style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0 }} />
                <div className="skeleton-box" style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0 }} />
                <div className="skeleton-box" style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0 }} />
              </div>
            </div>

            {/* Info Skeleton */}
            <div className="detail-info" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Category */}
              <div className="skeleton-box" style={{ width: 100, height: 14, borderRadius: 4, marginBottom: 16 }} />
              
              {/* Product Name */}
              <div className="skeleton-box" style={{ width: '90%', height: 32, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton-box" style={{ width: '60%', height: 32, borderRadius: 6, marginBottom: 24 }} />
              
              {/* Price Box */}
              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: 8, marginBottom: 24, border: '1px solid #f3f4f6' }}>
                <div className="skeleton-box" style={{ width: 60, height: 14, borderRadius: 4, marginBottom: 12 }} />
                <div className="skeleton-box" style={{ width: 160, height: 36, borderRadius: 6 }} />
              </div>

              {/* Variants */}
              <div style={{ marginBottom: 32 }}>
                <div className="skeleton-box" style={{ width: 100, height: 16, borderRadius: 4, marginBottom: 16 }} />
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="skeleton-box" style={{ width: 64, height: 42, borderRadius: 6 }} />
                  <div className="skeleton-box" style={{ width: 64, height: 42, borderRadius: 6 }} />
                  <div className="skeleton-box" style={{ width: 64, height: 42, borderRadius: 6 }} />
                </div>
              </div>

              {/* Buy Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
                <div className="skeleton-box" style={{ width: '100%', height: 48, borderRadius: 4 }} />
                <div className="skeleton-box" style={{ width: '100%', height: 48, borderRadius: 4 }} />
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton-box" style={{ width: '100%', height: 16, borderRadius: 4 }} />
                <div className="skeleton-box" style={{ width: '100%', height: 16, borderRadius: 4 }} />
                <div className="skeleton-box" style={{ width: '95%', height: 16, borderRadius: 4 }} />
                <div className="skeleton-box" style={{ width: '95%', height: 16, borderRadius: 4 }} />
                <div className="skeleton-box" style={{ width: '80%', height: 16, borderRadius: 4 }} />
              </div>
            </div>
            
          </div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{__html: `
        .skeleton-box {
          background: linear-gradient(110deg, #e5e7eb 30%, #f3f4f6 50%, #e5e7eb 70%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite linear;
        }
      `}} />
      
      <Footer />
    </>
  );
}
