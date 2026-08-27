// Vitest global setup: strip inherited HTTP(S) proxy env vars so tests that
// bind a localhost server and fetch() it aren't intercepted by an outer
// proxy (e.g. OneCLI's HTTPS_PROXY) which returns TLS handshake bytes to a
// plain-HTTP request and causes HPE_INVALID_CONSTANT / "fetch failed".
for (const key of [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'http_proxy',
  'https_proxy',
  'NODE_USE_ENV_PROXY',
  'ALL_PROXY',
  'all_proxy',
]) {
  delete process.env[key];
}
process.env.NO_PROXY = '*';
process.env.no_proxy = '*';
