export function optimizeCloudinaryUrl(url: string, width?: number, height?: number, crop: string = 'fill', quality: string = 'auto'): string {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  
  const regex = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;
  const match = url.match(regex);
  if (!match) return url;
  
  const base = match[1];
  let rest = match[2];
  
  // Clean existing transforms
  const parts = rest.split('/');
  const newParts = parts.filter(part => !/^(q_|f_|w_|h_|c_)/.test(part));
  
  const transforms = [`f_auto`, `q_${quality}`];
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (crop) transforms.push(`c_${crop}`);
  
  return `${base}${transforms.join(',')}/${newParts.join('/')}`;
}

export function generateCloudinarySrcSet(url: string, widths: number[] = [400, 800, 1200]): string {
  if (!url || !url.includes('res.cloudinary.com')) return '';
  return widths.map(w => `${optimizeCloudinaryUrl(url, w)} ${w}w`).join(', ');
}
