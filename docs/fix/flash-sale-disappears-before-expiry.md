# Bug Fix: Flash Sale Hilang Sebelum Waktunya

## Ringkasan

Banner Flash Sale tiba-tiba menghilang dari homepage meskipun waktu belum habis dan data di admin panel masih aktif. Bug hilang setelah redeploy tanpa perubahan data apapun.

---

## Gejala

- Flash Sale aktif dari admin panel, countdown masih berjalan
- Banner Flash Sale tiba-tiba tidak tampil di homepage
- Tidak ada perubahan data di Firestore
- Setelah redeploy, Flash Sale muncul kembali secara normal

---

## Root Cause Analysis

### Penyebab Utama (40%) — Static Route Handler

`/api/settings/route.ts` tidak memiliki `export const dynamic = 'force-dynamic'`.

Di Next.js 14 App Router, semua GET route handler yang tidak menggunakan `cookies()`, `headers()`, atau `export const dynamic = 'force-dynamic'` secara otomatis dianggap **static** — artinya response di-snapshot saat build time dan tidak diperbarui meskipun data Firestore berubah.

**Alur kejadian:**

1. Aplikasi di-deploy saat Flash Sale belum aktif atau sudah berakhir
2. `/api/settings` di-cache dengan response `{ isActive: false }`
3. Admin mengaktifkan Flash Sale dari panel (Firestore diupdate)
4. Homepage tetap menerima response lama dari cache build
5. `flashSaleActive` tetap `false` → banner tidak tampil
6. Redeploy memicu build baru → snapshot Firestore diambil ulang → banner muncul

### Penyebab Sekunder — Silent Error di API

Saat Firestore gagal (timeout, koneksi), error di-catch dan return `{ isActive: false, endsAt: null }` tanpa log. Akibatnya Flash Sale dimatikan secara diam-diam tanpa jejak error apapun.

### Penyebab Sekunder — Timer Tidak Di-cleanup

`setInterval` dibuat di dalam `useEffect` tanpa cleanup function. Saat komponen unmount dan remount (navigasi client-side), timer lama tetap berjalan bersamaan dengan timer baru, menyebabkan race condition pada state.

### Penyebab Sekunder — Tidak Ada Pengecekan `res.ok`

Fetch ke `/api/settings` langsung memanggil `.json()` tanpa memeriksa status HTTP. Jika API return 500, response tetap di-parse dan `.catch()` memanggil `setFlashSaleActive(false)`.

---

## File yang Diubah

### `app/api/settings/route.ts`

**Perubahan 1:** Tambah `export const dynamic = 'force-dynamic'` untuk memaksa route dieksekusi pada setiap request.

**Perubahan 2:** Ubah error handler dari silent fallback menjadi return HTTP 500 dengan log.

```typescript
// SEBELUM
} catch (error) {
  return NextResponse.json({ isActive: false, endsAt: null });
}

// SESUDAH
} catch (error) {
  console.error('[api/settings] Firestore error:', error);
  return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
}
```

---

### `app/page.tsx`

**Perubahan 1:** Cek `res.ok` sebelum parse JSON.

**Perubahan 2:** `.catch()` tidak lagi memanggil `setFlashSaleActive(false)` — hanya log error dan biarkan state default.

**Perubahan 3:** Timer di-cleanup saat component unmount via return function di `useEffect`.

**Perubahan 4:** Guard `isNaN(endTime)` dan `endTime <= Date.now()` sebelum timer dimulai untuk mencegah countdown berjalan pada value yang tidak valid.

```typescript
// SEBELUM
useEffect(() => {
  fetch('/api/settings')
    .then(res => res.json())
    .then(data => {
      if (data.isActive && data.endsAt) {
        setFlashSaleActive(true);
        const endTime = new Date(data.endsAt).getTime();
        const timer = setInterval(() => {
          // ...
        }, 1000);
      } else {
        setFlashSaleActive(false);
      }
    })
    .catch(() => setFlashSaleActive(false));
}, []);

// SESUDAH
useEffect(() => {
  let timer: ReturnType<typeof setInterval> | null = null;

  fetch('/api/settings')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data.isActive && data.endsAt) {
        const endTime = new Date(data.endsAt).getTime();
        if (isNaN(endTime) || endTime <= Date.now()) return;

        setFlashSaleActive(true);

        timer = setInterval(() => {
          const distance = endTime - Date.now();
          if (distance < 0) {
            clearInterval(timer!);
            setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            setFlashSaleActive(false);
            return;
          }
          setTimeLeft({
            days: Math.floor(distance / (1000 * 60 * 60 * 24)),
            hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((distance % (1000 * 60)) / 1000),
          });
        }, 1000);
      } else {
        setFlashSaleActive(false);
      }
    })
    .catch(err => {
      console.error('[FlashSale] fetch error:', err);
    });

  return () => {
    if (timer) clearInterval(timer);
  };
}, []);
```

---

## Ringkasan Perubahan

| File | Perubahan |
|---|---|
| `app/api/settings/route.ts` | Tambah `export const dynamic = 'force-dynamic'` |
| `app/api/settings/route.ts` | Error Firestore return HTTP 500 + log, bukan silent `{ isActive: false }` |
| `app/page.tsx` | Cek `res.ok` sebelum parse JSON response |
| `app/page.tsx` | `.catch()` hanya log error, tidak matikan flash sale |
| `app/page.tsx` | Timer di-cleanup saat component unmount |
| `app/page.tsx` | Guard `isNaN` dan expiry sebelum timer dimulai |

---

## Cara Verifikasi Fix

1. Deploy aplikasi saat Flash Sale **tidak aktif** di Firestore
2. Aktifkan Flash Sale dari admin panel
3. Akses homepage — banner harus muncul **tanpa redeploy**
4. Buka Network tab di DevTools → request `/api/settings` harus return data terbaru setiap kali
5. Header `x-nextjs-cache` tidak boleh bernilai `HIT` pada route ini
