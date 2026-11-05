import { SERVICE_NAME_CAVEAT, serviceRestartHint } from '../install-slug.js';

export function formatTransportError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('ENOENT') || msg.includes('ECONNREFUSED')) {
    // `bin/ncl` cd's to the project root before exec'ing client.ts, so
    // process.cwd() is the install dir — the install-slug helpers pick up the
    // right per-checkout suffix, and it is where the nohup launcher is. The
    // derived-name caveat and the per-platform finders live with
    // serviceRestartHint(); see install-slug.ts for why.
    return [
      `ncl: cannot reach NanoClaw host (${msg}).`,
      `Is the host running? Start it with: pnpm run dev`,
      `Or, if installed as a service — ${SERVICE_NAME_CAVEAT}`,
      serviceRestartHint(),
      `  Linux without systemd (e.g. WSL):  bash start-nanoclaw.sh (from ${process.cwd()})`,
      ``,
    ].join('\n');
  }
  return `ncl: transport error: ${msg}\n`;
}
