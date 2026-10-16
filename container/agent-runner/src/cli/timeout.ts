/**
 * How long the in-container `ncl` waits for the host's `cli-resp-<requestId>`
 * reply before giving up. Kept in its own module (ncl.ts runs main() on
 * import) because the host mirrors it: src/reconcile-session.ts closes
 * `cli-resp-*` rows still pending past this window plus a margin — by then no
 * requester can be polling for them. A host test pins the two values together.
 */
export const NCL_RESPONSE_TIMEOUT_MS = 30_000;
