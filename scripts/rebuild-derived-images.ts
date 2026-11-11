/**
 * rebuild-derived-images — re-derive the per-agent-group images on the current base image
 * without restarting any group.
 *
 * A group that ran `install_packages` pins `container_configs.image_tag` to
 * `${CONTAINER_IMAGE_BASE}:<agent-group-id>`. `buildAgentGroupImage()` built that image
 * `FROM ${CONTAINER_IMAGE}` at the time and labelled it `dev.nanoclaw.derived-from=<base id>`.
 * Rebuilding the base (`./container/build.sh`) leaves the pin and the derived image untouched,
 * so the group keeps spawning the previous agent-runner until the derived image is rebuilt.
 * `ncl groups restart --rebuild --id <id>` does that for one group and restarts it; this script is
 * the deploy-time variant: it rebuilds every pinned group whose label no longer matches the base,
 * re-points the same tag, and leaves running sessions alone. Sessions keep the image they started
 * with; new sessions get the new one.
 *
 * Usage, from the checkout with the install's .env applied (CONTAINER_IMAGE, DATA_DIR, …):
 *
 *   pnpm run rebuild:derived-images [-- --dry-run] [-- --force] [-- <agent-group-id>...]
 *
 *   --dry-run  print FRESH / STALE / MISSING per pinned group and build nothing
 *   --force    rebuild FRESH groups too
 *   ids        restrict to the given groups (default: every pinned group)
 *
 * Exit 0 when every requested build succeeded, 1 when one failed, 2 when the base image is
 * missing. Pins that are not `${CONTAINER_IMAGE_BASE}:<agent-group-id>` are operator-supplied
 * images, reported and left alone, the same rule `setup/registry-reconcile.ts` applies.
 */
import { spawnSync } from 'child_process';

import { derivedImageTag } from '../src/derived-image-repair.js';

/** One pinned derived image and how it relates to the current base. */
export interface DerivedImage {
  agentGroupId: string;
  tag: string;
  /** FRESH: built on the current base. STALE: built on an older base. MISSING: pin without an image. */
  state: 'FRESH' | 'STALE' | 'MISSING';
  /** Image creation time as the runtime reports it, '' when MISSING. */
  created: string;
}

/** `image inspect --format <format> <ref>`, or '' when the image does not exist. */
export type InspectImage = (ref: string, format: string) => string;

export interface Options {
  dryRun: boolean;
  force: boolean;
  /** Agent group ids to restrict to; empty means every pinned group. */
  only: Set<string>;
}

export function parseArgs(argv: string[]): Options {
  return {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    only: new Set(argv.filter((a) => !a.startsWith('--'))),
  };
}

export function dockerInspect(runtimeBin: string): InspectImage {
  return (ref, format) => {
    const r = spawnSync(runtimeBin, ['image', 'inspect', '--format', format, ref], { encoding: 'utf-8' });
    return r.status === 0 ? r.stdout.trim() : '';
  };
}

/**
 * Classify every pinned derived image against the current base id. Rows without a pin, rows whose
 * pin is not our derived tag (operator-supplied image), and rows outside `only` are skipped.
 */
export function classifyDerivedImages(
  rows: { agent_group_id: string; image_tag: string | null }[],
  imageBase: string,
  baseId: string,
  inspect: InspectImage,
  only: Set<string> = new Set(),
): DerivedImage[] {
  const out: DerivedImage[] = [];
  for (const row of rows) {
    const tag = derivedImageTag(imageBase, row.agent_group_id);
    if (row.image_tag !== tag) continue;
    if (only.size > 0 && !only.has(row.agent_group_id)) continue;
    const created = inspect(tag, '{{.Created}}');
    const derivedFrom = inspect(tag, '{{index .Config.Labels "dev.nanoclaw.derived-from"}}');
    const state = !created ? 'MISSING' : derivedFrom === baseId ? 'FRESH' : 'STALE';
    out.push({ agentGroupId: row.agent_group_id, tag, state, created });
  }
  return out;
}

/** STALE and MISSING images need a rebuild; FRESH ones only with --force. */
export function selectForRebuild(images: DerivedImage[], force: boolean): DerivedImage[] {
  return images.filter((img) => force || img.state !== 'FRESH');
}

export function summarize(images: DerivedImage[], rebuilt: number, failed: number, dryRun: boolean): string {
  const count = (s: DerivedImage['state']) => images.filter((i) => i.state === s).length;
  return (
    `derived images: ${images.length} pinned, ${count('FRESH')} fresh, ${count('STALE')} stale, ` +
    `${count('MISSING')} missing, ${rebuilt} rebuilt, ${failed} failed${dryRun ? ' (dry run)' : ''}`
  );
}

async function main(): Promise<number> {
  // Loaded here, not at module top, so the pure helpers above stay importable in tests without
  // the install's environment and database.
  const { CENTRAL_DB_PATH, CONTAINER_IMAGE, CONTAINER_IMAGE_BASE } = await import('../src/config.js');
  const { CONTAINER_RUNTIME_BIN } = await import('../src/container-runtime.js');
  const { closeDb, initDb } = await import('../src/db/connection.js');
  const { getAllContainerConfigs } = await import('../src/db/container-configs.js');
  const { buildAgentGroupImage } = await import('../src/container-runner.js');

  const opts = parseArgs(process.argv.slice(2));
  const inspect = dockerInspect(CONTAINER_RUNTIME_BIN);
  const baseId = inspect(CONTAINER_IMAGE, '{{.Id}}');
  if (!baseId) {
    console.error(`base image ${CONTAINER_IMAGE} not found; build it first (./container/build.sh)`);
    return 2;
  }
  console.log(
    `base ${CONTAINER_IMAGE} = ${baseId.slice(7, 19)} created ${inspect(CONTAINER_IMAGE, '{{.Created}}').slice(0, 19)}`,
  );

  await initDb(CENTRAL_DB_PATH, { role: 'tool' });
  let rebuilt = 0;
  let failed = 0;
  let images: DerivedImage[] = [];
  try {
    images = classifyDerivedImages(await getAllContainerConfigs(), CONTAINER_IMAGE_BASE, baseId, inspect, opts.only);
    for (const img of images) {
      console.log(`${img.agentGroupId} ${img.state}${img.created ? ` created=${img.created.slice(0, 19)}` : ''}`);
    }
    if (!opts.dryRun) {
      for (const img of selectForRebuild(images, opts.force)) {
        const t0 = Date.now();
        try {
          await buildAgentGroupImage(img.agentGroupId);
          rebuilt++;
          const seconds = Math.round((Date.now() - t0) / 1000);
          console.log(`rebuilt ${img.agentGroupId} in ${seconds}s -> ${inspect(img.tag, '{{.Id}}').slice(7, 19)}`);
        } catch (err) {
          failed++;
          console.log(`FAILED ${img.agentGroupId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  } finally {
    await closeDb();
  }
  console.log(summarize(images, rebuilt, failed, opts.dryRun));
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
