function cloudinaryLoader({ src, width, quality }) {
  if (!src.includes('res.cloudinary.com')) return src;
  
  const regex = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;
  const match = src.match(regex);
  if (!match) return src;
  
  const base = match[1];
  let rest = match[2];
  
  // Remove existing transformations like q_auto, f_auto, etc.
  // Transform format typically is <key>_<value>. We can just remove path segments that look like standard transforms.
  const parts = rest.split('/');
  const newParts = parts.filter(part => {
    return !/^(q_|f_|w_|h_|c_)/.test(part); // drop any segment starting with q_, f_, w_, h_, c_
  });
  
  const transformations = ['f_auto', 'q_auto', `w_${width}`, 'c_fill'];
  if (quality) {
    transformations[1] = `q_${quality}`; // override q_auto if quality provided
  }
  
  return `${base}${transformations.join(',')}/${newParts.join('/')}`;
}

console.log(cloudinaryLoader({ src: 'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780326022/99_u0fbp7.jpg', width: 400 }));
console.log(cloudinaryLoader({ src: 'https://res.cloudinary.com/dukddlp0b/image/upload/v1780326022/99_u0fbp7.jpg', width: 800, quality: 60 }));
