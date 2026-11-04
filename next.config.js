/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'down-id.img.susercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  // F-019 E11: a catalogue search (/produk?q=) is a view of /produk, never a page of its own. A header rule keeps the
  // route static (ISR) without middleware; the canonical stays /produk (F-005).
  async headers() {
    return [
      {
        source: '/produk',
        has: [{ type: 'query', key: 'q' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
    ];
  },
};

module.exports = nextConfig;
