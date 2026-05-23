// Tests for the overlay-marker materialization pipeline.
//
// The composer dispatches on overlay dir contents:
//   OVERLAY.md present → prose spliced into CLAUDE.md (existing behavior)
//   MARKER     present → file written to <groupDir>/.overlay-<name>
//
// Both clauses run independently. An overlay can carry prose, a marker, or
// both. spawn-buddy.sh (PR-B) tests for `[ -f /workspace/agent/.overlay-*]`
// to gate itself; this PR-A scaffolds the file emit so PR-B can land cleanly.

import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { materializeOverlayMarkers } from './claude-composer.js';

let tmpRoot: string;

function writeOverlay(
  root: string,
  dirName: string,
  frontmatter: Record<string, unknown>,
  body: string,
  marker: string | null,
): void {
  const dir = path.join(root, 'container', 'overlays', dirName);
  fs.mkdirSync(dir, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n');
  fs.writeFileSync(path.join(dir, 'OVERLAY.md'), `---\n${fm}\n---\n\n${body}\n`);
  if (marker !== null) fs.writeFileSync(path.join(dir, 'MARKER'), marker);
}

// Minimal coworker-types.yaml + workflow + skill scaffolding so the registry
// can resolve a single coworker that pulls in the test overlay via traits.
function scaffoldMinimalRegistry(root: string): void {
  // base-common workflow that the overlay can attach to via applies-to.workflows: [base]
  fs.mkdirSync(path.join(root, 'container', 'workflows', 'base'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'container', 'workflows', 'base', 'WORKFLOW.md'),
    `---\nname: base\nlicense: MIT\ntype: workflow\ndescription: "Base workflow"\nrequires: []\nuses: { skills: [], workflows: [] }\n---\n\nBase workflow body.\n`,
  );

  // Empty spine that 'test-coworker' references
  fs.mkdirSync(path.join(root, 'container', 'spines', 'tests'), { recursive: true });
  fs.writeFileSync(path.join(root, 'container', 'spines', 'tests', 'identity.md'), `You are a test coworker.\n`);

  // coworker-types.yaml at a known location
  fs.writeFileSync(
    path.join(root, 'container', 'spines', 'tests', 'coworker-types.yaml'),
    `project: tests\ntypes:\n  test-coworker:\n    title: Test\n    workflows: [base]\n    identity: container/spines/tests/identity.md\n`,
  );
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-markers-test-'));
  scaffoldMinimalRegistry(tmpRoot);
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('materializeOverlayMarkers', () => {
  it('writes .overlay-<name> file when overlay dir has a MARKER', () => {
    writeOverlay(
      tmpRoot,
      'with-marker',
      {
        name: 'with-marker',
        license: 'MIT',
        type: 'overlay',
        description: 'overlay with marker',
        'applies-to': { workflows: ['base'], traits: [], start: true },
        'insert-before': [],
        'insert-after': [],
        uses: { skills: [] },
      },
      'Marker overlay primer.',
      'with-marker\n',
    );

    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    materializeOverlayMarkers(['with-marker'], tmpRoot, groupDir);

    const target = path.join(groupDir, '.overlay-with-marker');
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, 'utf8').trim()).toBe('with-marker');

    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('skips overlays whose dir has no MARKER (prose-only overlay)', () => {
    writeOverlay(
      tmpRoot,
      'prose-only',
      {
        name: 'prose-only',
        license: 'MIT',
        type: 'overlay',
        description: 'overlay without marker',
        'applies-to': { workflows: ['base'], traits: [], start: true },
        'insert-before': [],
        'insert-after': [],
        uses: { skills: [] },
      },
      'Prose-only body.',
      null,
    );

    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    materializeOverlayMarkers(['prose-only'], tmpRoot, groupDir);

    expect(fs.existsSync(path.join(groupDir, '.overlay-prose-only'))).toBe(false);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('handles overlay names not in the catalog without throwing', () => {
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    expect(() => materializeOverlayMarkers(['does-not-exist'], tmpRoot, groupDir)).not.toThrow();
    expect(fs.readdirSync(groupDir)).toHaveLength(0);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('writes nothing when MARKER is empty', () => {
    writeOverlay(
      tmpRoot,
      'empty-marker',
      {
        name: 'empty-marker',
        license: 'MIT',
        type: 'overlay',
        description: 'empty marker',
        'applies-to': { workflows: ['base'], traits: [], start: true },
        'insert-before': [],
        'insert-after': [],
        uses: { skills: [] },
      },
      'Body.',
      '   \n',
    );

    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    materializeOverlayMarkers(['empty-marker'], tmpRoot, groupDir);

    expect(fs.existsSync(path.join(groupDir, '.overlay-empty-marker'))).toBe(false);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('is idempotent — second call overwrites with same content', () => {
    writeOverlay(
      tmpRoot,
      'idem',
      {
        name: 'idem',
        license: 'MIT',
        type: 'overlay',
        description: 'idempotent',
        'applies-to': { workflows: ['base'], traits: [], start: true },
        'insert-before': [],
        'insert-after': [],
        uses: { skills: [] },
      },
      'Body.',
      'idem',
    );

    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    materializeOverlayMarkers(['idem'], tmpRoot, groupDir);
    const first = fs.readFileSync(path.join(groupDir, '.overlay-idem'), 'utf8');
    materializeOverlayMarkers(['idem'], tmpRoot, groupDir);
    const second = fs.readFileSync(path.join(groupDir, '.overlay-idem'), 'utf8');
    expect(first).toBe(second);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });
});

// getAppliedOverlayNames is a thin wrapper around resolveCoworkerManifest +
// injectOverlays + dedup; the underlying resolution is exercised end-to-end
// by claude-composer.test.ts and lego-2-view.test.ts. The behavior unique to
// this helper (returning [] when disableOverlays is set) is covered by the
// composer's existing disable-overlays tests via the same predicate.
