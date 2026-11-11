/**
 * Rebuild a group's derived image when a wake finds it missing.
 *
 * A group that ran `install_packages` spawns from its own image,
 * `${CONTAINER_IMAGE_BASE}:<agent-group-id>`, which `buildAgentGroupImage()` layered onto the
 * base image. Nothing else recreates that image once it is gone. After an image prune or a disk
 * cleanup removes it, every wake of the group fails in `driver.prepare` with `image-unavailable`,
 * the host sweep retries once a minute, and the group's inbound messages stay pending until an
 * operator runs `ncl groups restart --rebuild`.
 *
 * The spawn path therefore starts that rebuild itself. The rebuild runs in the background: the
 * failing wake still returns false, and the first sweep tick after the build spawns from the new
 * image. One rebuild per group runs at a time, and a group is not rebuilt again within the cooldown
 * after an attempt, so a build that keeps failing (base image gone, package mirror down) costs one
 * build per cooldown rather than one per sweep tick.
 */
import type { SessionFailure } from './drivers/types.js';
import { log } from './log.js';

/** How long after a rebuild attempt the same group is not rebuilt again, whatever the outcome. */
export const DERIVED_IMAGE_REBUILD_COOLDOWN_MS = 15 * 60_000;

/**
 * Return the tag `buildAgentGroupImage()` gives a group's image: the install's image base with the
 * agent group id as the tag. A pin equal to it is a derived image this install builds and owns; any
 * other pin is an operator-supplied image.
 */
export function derivedImageTag(imageBase: string, agentGroupId: string): string {
  return `${imageBase}:${agentGroupId}`;
}

/** Return true when `err` is the driver's typed failure for an image the runtime does not have. */
export function isImageUnavailable(err: unknown): boolean {
  return err instanceof Error && (err as Partial<SessionFailure>).kind === 'image-unavailable';
}

/** What a failed `driver.prepare` knew about the image it tried to start. */
export interface FailedPrepare {
  err: unknown;
  /** The group's pin, `container_configs.image_tag`; undefined when the group runs the base image. */
  imageTag: string | undefined;
  imageBase: string;
  agentGroupId: string;
  /** The driver's `imageBuild` capability. */
  imageBuild: boolean;
}

/**
 * Return true when a failed `driver.prepare` should start a rebuild of the group's derived image.
 * That holds when the runtime reported the image missing, the image is the derived tag this install
 * builds for the group, and the driver can build images. A missing base image or a missing
 * operator-supplied pin stays with the operator, because nothing on this path knows how to produce
 * either.
 */
export function shouldRebuildDerivedImage(failed: FailedPrepare): boolean {
  return (
    failed.imageBuild &&
    isImageUnavailable(failed.err) &&
    failed.imageTag === derivedImageTag(failed.imageBase, failed.agentGroupId)
  );
}

export type RebuildRequest = 'started' | 'in-flight' | 'cooling-down';

const inFlight = new Map<string, Promise<void>>();
const lastAttemptAt = new Map<string, number>();

/**
 * Start `build(agentGroupId)` in the background, unless a rebuild of that group is already running
 * or one started within the cooldown. The returned value says which of the three happened. The call
 * never throws and the background build never rejects: a failed build is logged, and the first
 * request after the cooldown tries again.
 */
export function requestDerivedImageRebuild(
  agentGroupId: string,
  build: (agentGroupId: string) => Promise<void>,
  now: number = Date.now(),
): RebuildRequest {
  if (inFlight.has(agentGroupId)) return 'in-flight';
  const last = lastAttemptAt.get(agentGroupId);
  if (last !== undefined && now - last < DERIVED_IMAGE_REBUILD_COOLDOWN_MS) return 'cooling-down';

  lastAttemptAt.set(agentGroupId, now);
  log.warn('Derived image missing — rebuilding it', { agentGroupId });
  const startedAt = Date.now();
  const rebuild = Promise.resolve()
    .then(() => build(agentGroupId))
    .then(
      () => log.info('Derived image rebuilt', { agentGroupId, ms: Date.now() - startedAt }),
      (err: unknown) =>
        log.error('Derived image rebuild failed', {
          agentGroupId,
          err,
          retryAfterMs: DERIVED_IMAGE_REBUILD_COOLDOWN_MS,
        }),
    )
    .finally(() => inFlight.delete(agentGroupId));
  inFlight.set(agentGroupId, rebuild);
  return 'started';
}

/** Resolve once every rebuild running now has finished. */
export async function settleDerivedImageRebuilds(): Promise<void> {
  await Promise.all(inFlight.values());
}

/** Forget running rebuilds and cooldowns, so each test starts from a host that never rebuilt. */
export function resetDerivedImageRebuildsForTests(): void {
  inFlight.clear();
  lastAttemptAt.clear();
}
