import { getLaunchdLabel, getSystemdUnit } from '../install-slug.js';

export function formatTransportError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('ENOENT') || msg.includes('ECONNREFUSED')) {
    // `bin/ncl` cd's to the project root before exec'ing client.ts, so
    // process.cwd() is the install dir — install-slug helpers pick up
    // the right per-checkout suffix.
    // The unit/label below are DERIVED from the checkout path, so they are the
    // names a default install would have — not necessarily this one's. An
    // install whose service was registered under a custom name (e.g.
    // `nanoclaw-<user>-<instance>`) will not match, and following the hint
    // restarts nothing while looking like it should have worked. Say so, and
    // give the one-liner that finds the real unit.
    return [
      `ncl: cannot reach NanoClaw host (${msg}).`,
      `Is the host running? Start it with: pnpm run dev`,
      `Or, if installed as a service — these are the DEFAULT names for this`,
      `checkout; a service registered under a custom name will differ, find it`,
      `with \`systemctl --user list-units --all | grep -i claw\`:`,
      `  macOS:  launchctl kickstart -k gui/$(id -u)/${getLaunchdLabel()}`,
      `  Linux:  systemctl --user restart ${getSystemdUnit()}`,
      ``,
    ].join('\n');
  }
  return `ncl: transport error: ${msg}\n`;
}
