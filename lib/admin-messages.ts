// Turns API failures into instructions an INZTA admin can act on, instead of raw "Unauthorized".
export function adminErrorMessage(status: number, serverMessage?: string): string {
  if (status === 401) {
    return 'Sesi admin habis. Buka /admin/login di tab baru, masuk lagi, lalu ulangi. Isian form tidak hilang.';
  }
  if (status === 403) return 'Akun ini tidak punya akses admin. Hubungi Tim Developer.';
  return serverMessage || 'Gagal menyimpan. Coba lagi beberapa saat.';
}

export async function readAdminError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : undefined;
  return adminErrorMessage(res.status, message);
}
