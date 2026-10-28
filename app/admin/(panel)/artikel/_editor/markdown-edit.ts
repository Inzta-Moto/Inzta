// Link helpers shared by the link dialog and the Markdown serializer (markdown-doc.ts). The F-012 textarea
// transforms that used to live here were replaced by editor commands in F-013 phase B.

// URLs must not contain spaces or unbalanced parentheses.
export const encodeLinkUrl = (s: string) => s.trim().replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');

export function isAllowedLinkUrl(url: string): boolean {
  const u = url.trim();
  return /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(u) || /^\/(?![\/\\])\S*$/.test(u);
}
