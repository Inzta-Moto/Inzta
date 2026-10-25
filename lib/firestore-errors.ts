// gRPC status 6 (ALREADY_EXISTS) is what Firestore returns when create() hits an existing document.
export function isAlreadyExists(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  return e?.code === 6 || e?.code === 'already-exists' || /already exists/i.test(String(e?.message ?? ''));
}
