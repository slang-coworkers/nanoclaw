// The eval-sandbox overlay is a marker-plus-prose overlay like critique-gate: the
// composer must write `.overlay-eval-sandbox` for a group that selects it (the
// activation primitive for gate-eval-sandbox.sh) and splice its directives into
// every workflow that extends `base`, before the deliver/report steps, so the
// evaluation copy reads that it is one before it ships anything.

import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAppliedOverlayNames, materializeOverlayMarkers } from './claude-composer.js';
import { renderCoworkerSpine } from './claude-composer/spine.js';

const REAL_ROOT = process.cwd();
const OVERLAY_DIR = path.join(REAL_ROOT, 'container', 'overlays', 'eval-sandbox');

let tmpRoot: string;

// A registry with one coworker on the real `base` workflow, whose steps carry the
// `deliver` and `report` anchors the overlay targets.
function scaffold(root: string): void {
  fs.mkdirSync(path.join(root, 'container', 'workflows', 'base'), { recursive: true });
  fs.copyFileSync(
    path.join(REAL_ROOT, 'container', 'workflows', 'base', 'WORKFLOW.md'),
    path.join(root, 'container', 'workflows', 'base', 'WORKFLOW.md'),
  );
  fs.mkdirSync(path.join(root, 'container', 'overlays', 'eval-sandbox'), { recursive: true });
  for (const f of ['OVERLAY.md', 'MARKER']) {
    fs.copyFileSync(path.join(OVERLAY_DIR, f), path.join(root, 'container', 'overlays', 'eval-sandbox', f));
  }
  fs.mkdirSync(path.join(root, 'container', 'spines', 'tests'), { recursive: true });
  fs.writeFileSync(path.join(root, 'container', 'spines', 'tests', 'identity.md'), 'You are a test coworker.\n');
  fs.writeFileSync(
    path.join(root, 'container', 'spines', 'tests', 'coworker-types.yaml'),
    'test-coworker:\n  title: Test\n  description: "Test coworker"\n  workflows: [base]\n  identity: container/spines/tests/identity.md\n',
  );
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-sandbox-overlay-'));
  scaffold(tmpRoot);
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('eval-sandbox overlay', () => {
  it('ships a MARKER whose content is the overlay name', () => {
    expect(fs.readFileSync(path.join(OVERLAY_DIR, 'MARKER'), 'utf8').trim()).toBe('eval-sandbox');
    const fm = fs.readFileSync(path.join(OVERLAY_DIR, 'OVERLAY.md'), 'utf8');
    expect(fm).toMatch(/^---\nname: eval-sandbox\n/);
    expect(fm).toContain('type: overlay');
  });

  it('is applied and materialized as .overlay-eval-sandbox when a group selects it', () => {
    const applied = getAppliedOverlayNames(tmpRoot, 'test-coworker', { overlays: ['eval-sandbox'] });
    expect(applied).toContain('eval-sandbox');
    const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-'));
    try {
      materializeOverlayMarkers(applied, tmpRoot, groupDir);
      expect(fs.readFileSync(path.join(groupDir, '.overlay-eval-sandbox'), 'utf8').trim()).toBe('eval-sandbox');
    } finally {
      fs.rmSync(groupDir, { recursive: true, force: true });
    }
  });

  it('is not applied under disable_overlays, so no marker and no gate', () => {
    expect(
      getAppliedOverlayNames(tmpRoot, 'test-coworker', { overlays: ['eval-sandbox'], disableOverlays: true }),
    ).toEqual([]);
  });

  it('renders its directives into the composed document, like critique-gate', () => {
    const text = renderCoworkerSpine(tmpRoot, 'test-coworker', null, { overlays: ['eval-sandbox'] });
    expect(text).toContain('evaluation copy');
    expect(text).toContain('/workspace/agent/eval/<task-id>/r<k>/answer.json');
    expect(text).toContain('gate-eval-sandbox.sh');
    expect(text).toContain('eval-sandbox');
    const without = renderCoworkerSpine(tmpRoot, 'test-coworker', null, {});
    expect(without).not.toContain('evaluation copy');
  });
});
