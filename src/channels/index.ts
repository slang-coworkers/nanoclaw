// Channel self-registration barrel.
// Each import triggers the channel module's registerChannelAdapter() call.
//
// Main ships with one default channel — `cli`, the always-on local-terminal
// channel. Other channel skills (/add-slack, /add-discord, /add-whatsapp,
// ...) copy their module from the `channels` branch and append a
// self-registration import below.

import { log } from '../log.js';

import './cli.js';

import './telegram.js';

/**
 * Adapters that may or may not be in this tree.
 *
 * `dashboard` is the case this exists for. `dashboard.ts` lives on the
 * nv-dashboard overlay, but the registration has to be in THIS file, which
 * nv-main owns and the composer canonicalizes — so a plain
 * `import './dashboard.js';` is either present and broken on nv-main (barrel
 * unresolvable, every importer dies at module load) or absent and broken on the
 * composed tree (adapter never registers, delivery logs "No adapter for channel
 * type dashboard"). It has been both: #919 fixed the second by causing the
 * first, and nothing went red because a missing runtime import is not a type
 * error.
 *
 * A dynamic import resolves that: present → registers, absent → skipped. Top-
 * level await so registration completes before the barrel's importer proceeds,
 * exactly as the static imports above guarantee.
 */
for (const optional of ['./dashboard.js']) {
  try {
    await import(optional);
  } catch (err) {
    // ERR_MODULE_NOT_FOUND is the expected "not installed in this tree" answer.
    // Anything else means the module exists and threw while registering, which
    // must not be swallowed into a silent missing-adapter at delivery time.
    const code = (err as { code?: string } | null)?.code;
    if (code !== 'ERR_MODULE_NOT_FOUND' && code !== 'MODULE_NOT_FOUND') throw err;
    log.debug('Optional channel adapter not installed in this tree', { module: optional });
  }
}
