import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Guards the cli-tools.json seam: the global CLIs the agent invokes at runtime
// are installed from the manifest (a skill adds one with a json-merge), not
// hand-edited into the Dockerfile. These go red on a bad merge that drops a
// baseline tool, or on dewiring the Dockerfile / switching the installer off
// the pnpm supply-chain path.
const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'cli-tools.json'), 'utf8')) as Array<{
  name: string;
  version: string;
  onlyBuilt?: boolean;
}>;
const dockerfile = readFileSync(join(here, 'Dockerfile'), 'utf8');
const installer = readFileSync(join(here, 'install-cli-tools.sh'), 'utf8');

describe('cli-tools manifest', () => {
  it('is a non-empty array of { name, version }', () => {
    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest.length).toBeGreaterThan(0);
    for (const tool of manifest) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.version).toBe('string');
      expect(tool.version.length).toBeGreaterThan(0);
    }
  });

  it('has unique tool names (json-merge is keyed on name)', () => {
    const names = manifest.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('pins every version to an exact semver (no latest, no ranges — supply-chain policy)', () => {
    for (const tool of manifest) {
      expect(tool.version, `${tool.name} must be an exact semver, not "${tool.version}"`).toMatch(
        /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/,
      );
    }
  });

  it('keeps the baseline CLIs the agent depends on', () => {
    const names = manifest.map((t) => t.name);
    // Only what the agent cannot function without: a browser it drives, and the
    // provider CLI it runs. Everything else is opt-in — a tool nobody asked for
    // is bytes in every image, on every machine, for everyone.
    for (const required of ['agent-browser', '@anthropic-ai/claude-code']) {
      expect(names).toContain(required);
    }
  });

  it('bakes in nothing that a skill is meant to add on request', () => {
    // Regression guard for the opt-in boundary. `vercel` was baked in and is
    // now added by /add-vercel; anything reintroducing it here silently puts a
    // deployment CLI, and its credential surface, into every agent again.
    const names = manifest.map((t) => t.name);
    expect(names).not.toContain('vercel');
  });

  it('is wired into the Dockerfile build (COPY manifest + run installer)', () => {
    expect(dockerfile).toMatch(/COPY cli-tools\.json install-cli-tools\.sh/);
    expect(dockerfile).toMatch(/install-cli-tools\.sh \/tmp\/cli-tools\.json/);
  });

  it('installs via pnpm and writes only-built opt-ins (preserves the supply-chain path)', () => {
    expect(installer).toMatch(/pnpm install -g/);
    expect(installer).toMatch(/only-built-dependencies\[\]=/);
  });
});

describe('in-image release-age quarantine (F01)', () => {
  // These global installs resolve config from /root/.npmrc and never read the
  // repository's pnpm-workspace.yaml, so the three-day quarantine did not apply
  // to the packages that actually run inside the agent container. That is how
  // @openai/codex 0.146.1 entered the image ~14.6h after publication.

  it('writes a release-age floor into the config pnpm actually reads', () => {
    expect(installer).toMatch(/^MIN_RELEASE_AGE=\d+$/m);
    expect(installer).toMatch(/minimum-release-age=/);
    expect(installer).toMatch(/\/root\/\.npmrc/);
  });

  it('declares the same floor as pnpm-workspace.yaml (one policy, two install paths)', () => {
    const inImage = /^MIN_RELEASE_AGE=(\d+)$/m.exec(installer)?.[1];
    const workspace = /^minimumReleaseAge:\s*(\d+)\s*$/m.exec(
      readFileSync(join(here, '..', 'pnpm-workspace.yaml'), 'utf8'),
    )?.[1];
    expect(inImage, 'install-cli-tools.sh must declare MIN_RELEASE_AGE').toBeDefined();
    expect(workspace, 'pnpm-workspace.yaml must declare a top-level minimumReleaseAge').toBeDefined();
    expect(inImage).toBe(workspace);
  });

  it('PROVES the gate is in force rather than assuming it', () => {
    // Writing the setting is not evidence that it applies — a policy that looked
    // configured and was not is the entire finding. The installer probes with an
    // absurd age and requires the refusal, failing the build if pnpm ignores it.
    expect(installer).toMatch(/ERR_PNPM_NO_MATURE_MATCHING_VERSION/);
    expect(installer).toMatch(/PROBE_AGE=/);
  });

  it('does not carry a release-age exclusion list', () => {
    // minimumReleaseAgeExclude needs explicit human sign-off (CLAUDE.md), and
    // each entry is a permanent hole unless someone prunes it. Nothing in the
    // container build may add one quietly.
    expect(installer).not.toMatch(/minimumReleaseAgeExclude|minimum-release-age-exclude/);
  });
});
