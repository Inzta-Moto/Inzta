// "Bagikan produk" (F-016 S3.3.7): the share action of DetailClient.handleShare, unchanged. Image share through
// navigator.share with /api/proxy-image where supported, else WhatsApp with the product URL (plus ?aff=<id>).
export async function shareProduct(name: string, imageUrlRaw: string | null): Promise<void> {
  try {
    if (imageUrlRaw && navigator.canShare?.({ files: [new File([new Blob()], 'image.jpg', { type: 'image/jpeg' })] })) {
      let absolute = imageUrlRaw;
      if (!imageUrlRaw.startsWith('http')) absolute = window.location.origin + (imageUrlRaw.startsWith('/') ? '' : '/') + imageUrlRaw;
      const blob = await (await fetch(`/api/proxy-image/preview.jpg?url=${encodeURIComponent(absolute)}`)).blob();
      await navigator.share({ files: [new File([blob], 'product.jpg', { type: blob.type || 'image/jpeg' })], title: name });
    } else throw new Error('not supported');
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      // Only the link, so WhatsApp builds the preview from the page's og:image.
      const baseUrl = window.location.origin + window.location.pathname;
      const affiliateId = localStorage.getItem('inzta_affiliate');
      const shareUrl = affiliateId ? `${baseUrl}?aff=${affiliateId}` : baseUrl;
      window.location.href = `https://wa.me/?text=${encodeURIComponent(shareUrl)}`;
    }
  }
}
