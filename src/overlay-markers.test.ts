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

import {
  getAppliedOverlayNames,
  materializeCritiqueDeliveryMarkers,
  materializeCritiqueRequiredStages,
  materializeOverlayMarkers,
} from './claude-composer.js';

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

  // coworker-types.yaml — production format has type keys at top level
  fs.writeFileSync(
    path.join(root, 'container', 'spines', 'tests', 'coworker-types.yaml'),
    `test-coworker:\n  title: Test\n  description: "Test coworker"\n  workflows: [base]\n  identity: container/spines/tests/identity.md\n`,
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

// getAppliedOverlayNames returns names from two sources, unioned:
//   1. anchor-spliced overlays (kind:'overlay' customizations from manifest)
//   2. operator-selected overlays from agent_groups.overlays — even if their
//      applies-to is empty, so MARKER materialization is decoupled from
//      anchor placement (lets pure-hook overlays like critique-gate activate
//      without spine prose).
describe('getAppliedOverlayNames decouples MARKER from anchor placement', () => {
  it('returns operator-selected overlay even when applies-to.workflows is empty', () => {
    // Pure-hook overlay: empty applies-to → no anchor target, no spine prose.
    writeOverlay(
      tmpRoot,
      'hook-only',
      {
        name: 'hook-only',
        license: 'MIT',
        type: 'overlay',
        description: 'pure-hook overlay (empty applies-to)',
        'applies-to': { workflows: [], traits: [], start: false },
        'insert-before': [],
        'insert-after': [],
        uses: { skills: [] },
      },
      'No prose.',
      'hook-only',
    );

    const applied = getAppliedOverlayNames(tmpRoot, 'test-coworker', {
      overlays: ['hook-only'],
      cliScope: 'group',
    });
    expect(applied).toContain('hook-only');
  });

  it('returns the operator-selected overlay AND any anchor-spliced overlay (union)', () => {
    writeOverlay(
      tmpRoot,
      'hook-only',
      {
        name: 'hook-only',
        license: 'MIT',
        type: 'overlay',
        description: 'pure-hook',
        'applies-to': { workflows: [], traits: [], start: false },
        'insert-before': [],
        'insert-after': [],
        uses: { skills: [] },
      },
      '.',
      'hook-only',
    );
    writeOverlay(
      tmpRoot,
      'spliced',
      {
        name: 'spliced',
        license: 'MIT',
        type: 'overlay',
        description: 'spliced overlay',
        'applies-to': { workflows: ['base'], traits: [], start: true },
        'insert-before': [],
        'insert-after': [],
        uses: { skills: [] },
      },
      'Spliced body.',
      'spliced',
    );

    const applied = getAppliedOverlayNames(tmpRoot, 'test-coworker', {
      overlays: ['hook-only', 'spliced'],
      cliScope: 'group',
    });
    expect(new Set(applied)).toEqual(new Set(['hook-only', 'spliced']));
  });

  it('returns [] when disableOverlays kills both anchor-spliced AND operator-selected (R3)', () => {
    writeOverlay(
      tmpRoot,
      'hook-only',
      {
        name: 'hook-only',
        license: 'MIT',
        type: 'overlay',
        description: 'pure-hook',
        'applies-to': { workflows: [], traits: [], start: false },
        'insert-before': [],
        'insert-after': [],
        uses: { skills: [] },
      },
      '.',
      'hook-only',
    );
    const applied = getAppliedOverlayNames(tmpRoot, 'test-coworker', {
      overlays: ['hook-only'],
      disableOverlays: true,
      cliScope: 'group',
    });
    expect(applied).toEqual([]);
  });

  it('default state with no overlays returns [] (R1)', () => {
    const applied = getAppliedOverlayNames(tmpRoot, 'test-coworker', { cliScope: 'group' });
    expect(applied).toEqual([]);
  });

  it('ignores names that are not overlays in the catalog', () => {
    fs.mkdirSync(path.join(tmpRoot, 'container', 'skills', 'not-an-overlay'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'container', 'skills', 'not-an-overlay', 'SKILL.md'),
      `---\nname: not-an-overlay\nlicense: MIT\ntype: skill\ndescription: skill not overlay\nuses: { skills: [] }\n---\n\nbody.\n`,
    );
    const applied = getAppliedOverlayNames(tmpRoot, 'test-coworker', {
      overlays: ['not-an-overlay'],
      cliScope: 'group',
    });
    expect(applied).toEqual([]);
  });
});

// `required_critique_stages` declared per coworker-type in coworker-types.yaml,
// inherited via `extends:`. The composer unions across the chain and writes
// `<groupDir>/.critique-required-stages` (JSON list) — but ONLY when the
// `critique-gate` overlay is in the active overlay set. If the overlay is
// disabled (kill switch) or not opted in, the file is skipped (or removed
// if stale) so the on-disk state matches the active overlay configuration.
describe('materializeCritiqueRequiredStages', () => {
  function writeTypesYaml(spineName: string, types: Record<string, Record<string, unknown>>): void {
    const dir = path.join(tmpRoot, 'container', 'spines', spineName);
    fs.mkdirSync(dir, { recursive: true });
    const lines: string[] = [];
    for (const [name, body] of Object.entries(types)) {
      lines.push(`${name}:`);
      for (const [k, v] of Object.entries(body)) {
        lines.push(`  ${k}: ${typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v)}`);
      }
    }
    fs.writeFileSync(path.join(dir, 'coworker-types.yaml'), lines.join('\n') + '\n');
  }

  it('writes [] (no file) when critique-gate is NOT in appliedOverlays — kill switch / not opted in', async () => {
    writeTypesYaml('test2', {
      'stage-type': { description: 'has stages', required_critique_stages: ['CODE_REVIEW', 'OUTPUT_REVIEW'] },
    });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    const types = readCoworkerTypes(tmpRoot);
    materializeCritiqueRequiredStages('stage-type', types, [], groupDir);
    expect(fs.existsSync(path.join(groupDir, '.critique-required-stages'))).toBe(false);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('removes a stale stages file when critique-gate is dropped from the overlay set', async () => {
    writeTypesYaml('test3', {
      'stage-type': { description: 'has stages', required_critique_stages: ['CODE_REVIEW'] },
    });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    fs.writeFileSync(path.join(groupDir, '.critique-required-stages'), '["STALE"]');
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueRequiredStages('stage-type', readCoworkerTypes(tmpRoot), [], groupDir);
    expect(fs.existsSync(path.join(groupDir, '.critique-required-stages'))).toBe(false);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('writes the coworker type’s stages when critique-gate is opted in', async () => {
    writeTypesYaml('test4', {
      writer: { description: 'writer', required_critique_stages: ['PLAN_REVIEW', 'CODE_REVIEW', 'OUTPUT_REVIEW'] },
    });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueRequiredStages('writer', readCoworkerTypes(tmpRoot), ['critique-gate'], groupDir);
    const written = JSON.parse(fs.readFileSync(path.join(groupDir, '.critique-required-stages'), 'utf8'));
    expect(new Set(written)).toEqual(new Set(['PLAN_REVIEW', 'CODE_REVIEW', 'OUTPUT_REVIEW']));
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('inherits stages from the extends chain (parent → child via `extends:`)', async () => {
    writeTypesYaml('test5', {
      'writer-base': { description: 'base writer', required_critique_stages: ['PLAN_REVIEW', 'CODE_REVIEW'] },
      'project-fixer': {
        extends: 'writer-base',
        description: 'project fixer extends base',
        required_critique_stages: ['OUTPUT_REVIEW'],
      },
    });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueRequiredStages('project-fixer', readCoworkerTypes(tmpRoot), ['critique-gate'], groupDir);
    const written = JSON.parse(fs.readFileSync(path.join(groupDir, '.critique-required-stages'), 'utf8'));
    expect(new Set(written)).toEqual(new Set(['PLAN_REVIEW', 'CODE_REVIEW', 'OUTPUT_REVIEW']));
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('dedupes overlapping stages from parent + child', async () => {
    writeTypesYaml('test6', {
      parent: { description: 'parent', required_critique_stages: ['CODE_REVIEW', 'OUTPUT_REVIEW'] },
      child: {
        extends: 'parent',
        description: 'child overlaps parent',
        required_critique_stages: ['CODE_REVIEW', 'PLAN_REVIEW'],
      },
    });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueRequiredStages('child', readCoworkerTypes(tmpRoot), ['critique-gate'], groupDir);
    const written = JSON.parse(fs.readFileSync(path.join(groupDir, '.critique-required-stages'), 'utf8'));
    expect(new Set(written)).toEqual(new Set(['CODE_REVIEW', 'OUTPUT_REVIEW', 'PLAN_REVIEW']));
    expect(written.length).toBe(3);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('rejects non-uppercase / malformed stage names', async () => {
    writeTypesYaml('test7', {
      mixed: {
        description: 'mixed stages',
        required_critique_stages: ['CODE_REVIEW', 'lowercase', 'has space', '123', 'OUTPUT_REVIEW'],
      },
    });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueRequiredStages('mixed', readCoworkerTypes(tmpRoot), ['critique-gate'], groupDir);
    const written = JSON.parse(fs.readFileSync(path.join(groupDir, '.critique-required-stages'), 'utf8'));
    expect(new Set(written)).toEqual(new Set(['CODE_REVIEW', 'OUTPUT_REVIEW']));
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('writes [] when coworker has critique-gate but no stages declared (legacy mode passthrough)', async () => {
    writeTypesYaml('test8', { 'no-stages': { description: 'no stages' } });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueRequiredStages('no-stages', readCoworkerTypes(tmpRoot), ['critique-gate'], groupDir);
    const written = JSON.parse(fs.readFileSync(path.join(groupDir, '.critique-required-stages'), 'utf8'));
    expect(written).toEqual([]);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });
});

// `delivery_markers` / `pr_command_patterns` declared per coworker-type in
// coworker-types.yaml, unioned across the extends chain and materialized to
// `<groupDir>/.critique-delivery-markers`. These prove the YAML-key → parse →
// sanitize → materialize path end-to-end (the gate-level tests only exercise
// a synthetic marker file). The built-in vocabulary is NOT declared here —
// it lives in the hooks; these entries are ADDITIVE, so a role only needs an
// entry for a NEW delivery shape.
describe('materializeCritiqueDeliveryMarkers', () => {
  function writeTypesYaml(spineName: string, types: Record<string, Record<string, unknown>>): void {
    const dir = path.join(tmpRoot, 'container', 'spines', spineName);
    fs.mkdirSync(dir, { recursive: true });
    const lines: string[] = [];
    for (const [name, body] of Object.entries(types)) {
      lines.push(`${name}:`);
      for (const [k, v] of Object.entries(body)) {
        lines.push(`  ${k}: ${JSON.stringify(v)}`);
      }
    }
    fs.writeFileSync(path.join(dir, 'coworker-types.yaml'), lines.join('\n') + '\n');
  }

  it('writes the file even WITHOUT critique-gate when markers are declared (feeds the always-on routing gate)', async () => {
    // Post floor-slim: delivery vocabulary is NOT gated on the critique-gate
    // overlay — a non-critique-gated role (triager/reviewer) still needs its
    // role markers materialized so the always-on routing gate recognizes them.
    writeTypesYaml('dm1', { 'm-type': { description: 'x', delivery_markers: ['Weekly Report'] } });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueDeliveryMarkers('m-type', readCoworkerTypes(tmpRoot), [], groupDir); // [] = no critique-gate
    const written = JSON.parse(fs.readFileSync(path.join(groupDir, '.critique-delivery-markers'), 'utf8'));
    expect(new Set(written.message_markers)).toEqual(new Set(['Weekly Report']));
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('removes a stale file when the type declares NO markers', async () => {
    writeTypesYaml('dm2', { 'm-type': { description: 'no vocab' } });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    fs.writeFileSync(path.join(groupDir, '.critique-delivery-markers'), '{"message_markers":["STALE"]}');
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueDeliveryMarkers('m-type', readCoworkerTypes(tmpRoot), [], groupDir);
    expect(fs.existsSync(path.join(groupDir, '.critique-delivery-markers'))).toBe(false);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('writes declared markers + patterns when opted in', async () => {
    writeTypesYaml('dm3', {
      'm-type': {
        description: 'x',
        delivery_markers: ['Weekly Report', 'Status Digest'],
        pr_command_patterns: ['glab mr create'],
      },
    });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueDeliveryMarkers('m-type', readCoworkerTypes(tmpRoot), ['critique-gate'], groupDir);
    const written = JSON.parse(fs.readFileSync(path.join(groupDir, '.critique-delivery-markers'), 'utf8'));
    expect(new Set(written.message_markers)).toEqual(new Set(['Weekly Report', 'Status Digest']));
    expect(written.bash_patterns).toEqual(['glab mr create']);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('unions markers across the extends chain', async () => {
    writeTypesYaml('dm4', {
      base: { description: 'base', delivery_markers: ['Base Report'] },
      child: { extends: 'base', description: 'child', delivery_markers: ['Child Report'] },
    });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueDeliveryMarkers('child', readCoworkerTypes(tmpRoot), ['critique-gate'], groupDir);
    const written = JSON.parse(fs.readFileSync(path.join(groupDir, '.critique-delivery-markers'), 'utf8'));
    expect(new Set(written.message_markers)).toEqual(new Set(['Base Report', 'Child Report']));
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('rejects markers with regex metacharacters (sanitization at the registry)', async () => {
    writeTypesYaml('dm5', {
      'm-type': {
        description: 'x',
        // ".*" / "[x]" would be catastrophic if spliced into the gate's ERE alternation.
        delivery_markers: ['Good Marker', '.*', '[evil]', 'has|pipe', 'Also OK'],
      },
    });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueDeliveryMarkers('m-type', readCoworkerTypes(tmpRoot), ['critique-gate'], groupDir);
    const written = JSON.parse(fs.readFileSync(path.join(groupDir, '.critique-delivery-markers'), 'utf8'));
    expect(new Set(written.message_markers)).toEqual(new Set(['Good Marker', 'Also OK']));
    fs.rmSync(groupDir, { recursive: true, force: true });
  });

  it('writes no file when opted in but nothing declared (built-ins only)', async () => {
    writeTypesYaml('dm6', { 'm-type': { description: 'no vocab' } });
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    const { readCoworkerTypes } = await import('./claude-composer.js');
    materializeCritiqueDeliveryMarkers('m-type', readCoworkerTypes(tmpRoot), ['critique-gate'], groupDir);
    expect(fs.existsSync(path.join(groupDir, '.critique-delivery-markers'))).toBe(false);
    fs.rmSync(groupDir, { recursive: true, force: true });
  });
});

// Contract: the SHIPPED base-common declares the standard chain-role delivery
// vocabulary. The built-in gate floor carries only the general primitives
// (Resolution/handoff); every project role inherits these standard markers via
// `extends: base-common`, so deleting one here silently un-gates that marker
// for every fixer/reviewer/triager across all project spines.
describe('base-common standard delivery vocabulary (shipped contract)', () => {
  it('declares the five standard chain-role markers', async () => {
    const { readCoworkerTypes } = await import('./claude-composer.js');
    const types = readCoworkerTypes(process.cwd());
    expect(new Set(types['base-common']?.deliveryMarkers ?? [])).toEqual(
      new Set(['Fix Report', 'Fix Review Request', 'Review Verdict', 'Triage Resolution', 'Triage handoff']),
    );
  });
});
