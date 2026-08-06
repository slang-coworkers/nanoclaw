/**
 * Per-checkout install identifiers. Lets two NanoClaw installs coexist on
 * one host without clobbering each other's service registration or the
 * shared `nanoclaw-agent:latest` docker image tag.
 *
 * Slug is sha1(projectRoot)[:8] — deterministic per checkout path, stable
 * across re-runs, unique enough across installs.
 */
import { createHash } from 'crypto';

export function getInstallSlug(projectRoot: string = process.cwd()): string {
  return createHash('sha1').update(projectRoot).digest('hex').slice(0, 8);
}

/** launchd Label + plist basename. e.g. `com.nanoclaw-v2-ab12cd34`. */
export function getLaunchdLabel(projectRoot?: string): string {
  return `com.nanoclaw-v2-${getInstallSlug(projectRoot)}`;
}

/** systemd unit name (no .service suffix). e.g. `nanoclaw-v2-ab12cd34`. */
export function getSystemdUnit(projectRoot?: string): string {
  return `nanoclaw-v2-${getInstallSlug(projectRoot)}`;
}

/** Docker image base (no tag). e.g. `nanoclaw-agent-v2-ab12cd34`. */
export function getContainerImageBase(projectRoot?: string): string {
  return `nanoclaw-agent-v2-${getInstallSlug(projectRoot)}`;
}

/** Default full container image reference with `:latest` tag. */
export function getDefaultContainerImage(projectRoot?: string): string {
  return `${getContainerImageBase(projectRoot)}:latest`;
}

/**
 * The per-platform "restart the service" block shown when NanoClaw can't be
 * reached. ONE source for every call site.
 *
 * Two things this encodes, both learned from getting them wrong:
 *
 * 1. The names below are DERIVED FROM THE CHECKOUT PATH, so they are the names a
 *    default install would have — not necessarily this one's. An install whose
 *    service was registered under a custom name (`nanoclaw-<user>-<instance>`)
 *    will not match, and following the hint restarts nothing while looking like
 *    it should have worked. Hence the caveat and the finders.
 * 2. Each platform gets its OWN finder. A single shared
 *    `systemctl --user list-units | grep -i claw` printed above both lines tells
 *    a macOS operator to run systemctl — precisely the confidently-wrong command
 *    this text exists to prevent.
 *
 * It lives here because the guidance previously existed in two hand-maintained
 * copies (`src/cli/transport-errors.ts` and `setup/auto.ts`). They diverged: the
 * ncl copy was corrected while the setup copy kept printing an unqualified unit
 * name. A second copy is how that happens, so there is now only one.
 */
export function serviceRestartHint(projectRoot?: string): string {
  return [
    `  macOS:  launchctl kickstart -k gui/$(id -u)/${getLaunchdLabel(projectRoot)}`,
    '          find it: launchctl list | grep -i claw',
    `  Linux:  systemctl --user restart ${getSystemdUnit(projectRoot)}`,
    '          find it: systemctl --user list-units --all | grep -i claw',
  ].join('\n');
}

/** The caveat that must accompany {@link serviceRestartHint}. */
export const SERVICE_NAME_CAVEAT =
  'These are the DEFAULT names for this checkout; a service registered under a ' +
  'custom name will differ, so if the restart reports "not found", find the real one first:';
