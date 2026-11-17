/**
 * Classifies errors from reading a per-session inbound.db / outbound.db.
 *
 * A session DB can lack a table or column because the session predates it or
 * has not written its first message yet. That file is readable and holds no
 * matching rows, so a scan treats it as empty and caches that until the file
 * changes. Any other error (a locked, busy or corrupt file) is transient: the
 * scan keeps its last good value and retries. scan-worker.mjs, which is plain JS,
 * carries the same test inline.
 */
export function isMissingSchemaError(e: unknown): boolean {
  return e instanceof Error && /no such (table|column)/i.test(e.message);
}
