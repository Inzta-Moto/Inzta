import Link from 'next/link';
import { Package, Plus, ExternalLink, Clipboard, Users, Banknote, Clock } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function countQuery(query: FirebaseFirestore.Query) {
  try {
    const snap = await query.count().get();
    return snap.data().count || 0;
  } catch {
    const snap = await query.get();
    return snap.size;
  }
}

export default async function AdminDashboard() {
  const auth = await verifyAdminSession();
  if (auth.error) {
    redirect('/admin/login');
  }

  let stats: any = {
    total: 0, active: 0, lowStock: 0, lowList: [],
    totalOrders: 0, pendingOrders: 0, totalAffiliates: 0, totalRevenue: 0,
    recentOrders: []
  };

  try {
    const db = getAdminDb();
    const products = db.collection('products');
    const orders = db.collection('orders');
    const affiliates = db.collection('affiliates');

    const [total, active, lowStock, totalOrders, pendingOrders, totalAffiliates] = await Promise.all([
      countQuery(products),
      countQuery(products.where('isActive', '==', true)),
      countQuery(products.where('stock', '<=', 10)),
      countQuery(orders),
      countQuery(orders.where('status', '==', 'pending')),
      countQuery(affiliates),
    ]);

    // Calculate total revenue
    const completedOrdersSnap = await orders.where('status', '==', 'completed').get();
    const totalRevenue = completedOrdersSnap.docs.reduce((sum, doc) => sum + (doc.data().finalPrice || 0), 0);

    const lowSnap = await products.where('stock', '<=', 10).orderBy('stock', 'asc').limit(10).get();
    const lowList = lowSnap.docs.map(doc => {
      const data = doc.data() as any;
      return {
        name: data.name || 'Produk',
        slug: data.slug || doc.id,
        stock: typeof data.stock === 'number' ? data.stock : 0,
      };
    });

    // Fetch Recent Orders
    const recentOrdersSnap = await orders.orderBy('createdAt', 'desc').limit(5).get();
    const recentOrders = recentOrdersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        orderId: data.orderId,
        customerName: data.customerName,
        finalPrice: data.finalPrice,
        status: data.status,
      };
    });

    stats = {
      total, active, lowStock, lowList, 
      totalOrders, pendingOrders, totalAffiliates, totalRevenue,
      recentOrders
    };
  } catch (error) {
    console.error('Failed to fetch dashboard stats', error);
  }

  const statItems = [
    { n: formatPrice(stats.totalRevenue), l: 'Total Penjualan', icon: <Banknote size={24} /> },
    { n: stats.totalOrders, l: 'Total Pesanan', icon: <Clipboard size={24} /> },
    { n: stats.pendingOrders, l: 'Pesanan Pending', icon: <Clock size={24} /> },
    { n: stats.totalAffiliates, l: 'Afiliasi', icon: <Users size={24} /> },
    { n: stats.total, l: 'Total Produk', icon: <Package size={24} /> },
    { n: stats.lowStock, l: 'Stok Rendah', icon: <Package size={24} /> },
  ];

  return (
    <>
      <h1 className="admin-page-title" style={{ marginBottom: 24 }}>Dashboard</h1>
      
      <div className="admin-stats-grid">
        {statItems.map((s, i) => (
          <div className="admin-stat-card" key={i}>
            <div className="admin-stat-icon" style={{ color: '#666' }}>
              {s.icon}
            </div>
            <div>
              <div className="admin-stat-number">{s.n}</div>
              <div className="admin-stat-label">{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid-responsive">
        {/* Recent Orders Panel */}
        <div className="dash-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #eee' }}>
          <div className="dash-panel-header"><h3 className="dash-panel-title" style={{ marginBottom: 16 }}>Pesanan Terbaru</h3></div>
          <div className="dash-list">
            {stats.recentOrders.length === 0 ? <p className="dash-empty">Tidak ada pesanan terbaru.</p> : stats.recentOrders.map((o: any) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>#{o.orderId || o.id}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{o.customerName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{formatPrice(o.finalPrice)}</div>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: o.status === 'pending' ? '#fff3e0' : '#e8f5e9', color: o.status === 'pending' ? '#ef6c00' : '#2e7d32' }}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Low Stock Panel */}
          <div className="dash-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #eee' }}>
            <div className="dash-panel-header"><h3 className="dash-panel-title" style={{ marginBottom: 16 }}>Stok Rendah</h3></div>
            <div className="dash-list">
              {stats.lowList.length === 0 ? <p className="dash-empty">Tidak ada produk stok rendah.</p> : stats.lowList.map((p: any) => (
                <div key={p.slug} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span className="dash-list-name">{p.name}</span>
                  <span style={{ color: p.stock <= 5 ? 'red' : 'inherit' }}>{p.stock} unit</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Aksi Cepat Panel */}
          <div className="dash-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #eee' }}>
            <div className="dash-panel-header"><h3 className="dash-panel-title" style={{ marginBottom: 16 }}>Aksi Cepat</h3></div>
            <div className="dash-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/admin/produk" className="dash-action-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px', background: '#f5f5f5', borderRadius: 6, textDecoration: 'none', color: '#111' }}>
                <Plus size={14} /> Tambah Produk
              </Link>
              <a href="/produk" target="_blank" className="dash-action-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px', background: '#f5f5f5', borderRadius: 6, textDecoration: 'none', color: '#111' }}>
                <ExternalLink size={14} /> Lihat Toko
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
