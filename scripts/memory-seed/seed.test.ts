import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { excludeReason, isSafeSeedPath } from './scope.js';
import { exportSeed, importSeed, MANIFEST, PROVENANCE, SeedConflictError } from './seed.js';

// A tree shaped like a real prod triager's memory: OKF index + system/, concept
// folders, loose root notes, the pre-synthesis imported/ dossier, and a repro dir
// of non-markdown resources — plus the install-local files that must stay behind.
const TREE: Record<string, string | Buffer> = {
  'index.md': '---\nokf_version: 1\n---\n# Memory\n\nCore: triage slang/slang.\n',
  'system/index.md': '- [Definition](definition.md)\n',
  'system/definition.md': 'evolved doctrine\n',
  'issues/slang-12197-coercion.md': '---\ntype: issue\n---\nfix used glpat-EXAMPLEfakeGitlabToken123 once\n',
  'chains/pr-13213.md': '---\ntype: chain\n---\nchain notes\n',
  'lessons/verify-the-path.md': '---\ntype: lesson\n---\nverify against the runtime path\n',
  'imported/dossier-old.md': 'pre-synthesis dossier\n',
  'triage-12621.md': 'loose root note\n',
  'repro-slangpy-1059/min.slang': 'struct S { float3 v; };\n',
  'repro-slangpy-1059/f3_loop.cu': '__global__ void k() {}\n',
  'fix-10267.patch': '--- a/x\n+++ b/x\n',
  // install-local / transient — never carried
  '.okf-synth-state.json': '{"runs":[{"backlog":3}]}\n',
  'imported/MEMORY.md.tmp': 'crashed write\n',
  // binary — the scrubber cannot vet it
  'repro-slangpy-1059/blob.bin': Buffer.from([0xff, 0xfe, 0x00, 0x80, 0xc3]),
};

let tmp: string;
let srcRoot: string;
let dstRoot: string;
let outRoot: string;
let scaffoldDir: string;

function writeTree(memDir: string, tree: Record<string, string | Buffer>): void {
  for (const [rel, body] of Object.entries(tree)) {
    const p = path.join(memDir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
}

function exportFixture() {
  return exportSeed({ groupsRoot: srcRoot, group: 'slang-triager', out: outRoot });
}

const seedDir = () => path.join(outRoot, 'slang-triager');

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memseed-'));
  srcRoot = path.join(tmp, 'src-groups');
  dstRoot = path.join(tmp, 'dst-groups');
  outRoot = path.join(tmp, 'seeds');
  scaffoldDir = path.join(tmp, 'templates');
  const srcMem = path.join(srcRoot, 'slang-triager', 'memory');
  writeTree(srcMem, TREE);
  fs.symlinkSync('/etc/hosts', path.join(srcMem, 'escape-link.md'));
  writeTree(scaffoldDir, {
    'index.md': 'pristine scaffold index\n',
    'system/index.md': 'pristine scaffold system index\n',
    'system/definition.md': 'pristine scaffold definition\n',
  });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('scope rule', () => {
  it('keeps every learning location and resource, anywhere in the tree', () => {
    for (const rel of [
      'index.md',
      'system/definition.md',
      'issues/a.md',
      'triage-1.md',
      'repro/min.cu',
      'fix.patch',
      'x.yml.draft',
    ]) {
      expect(excludeReason(rel)).toBeNull();
    }
  });

  it('leaves install-local and transient files behind', () => {
    expect(excludeReason('.okf-synth-state.json')).toBe('dotfile');
    expect(excludeReason('.memory-seed-import.json')).toBe('dotfile');
    expect(excludeReason('notes/.cache/x.md')).toBe('dotfile');
    expect(excludeReason('imported/MEMORY.md.tmp')).toBe('transient');
    expect(excludeReason('draft.md.swp')).toBe('transient');
    expect(excludeReason('x.md~')).toBe('transient');
  });

  it('rejects unsafe manifest paths', () => {
    for (const bad of [
      '',
      '../x.md',
      'a/../b.md',
      '/etc/passwd',
      'a//b.md',
      './a.md',
      'a\\b.md',
      'C:/x.md',
      '.okf-synth-state.json',
      42,
    ]) {
      expect(isSafeSeedPath(bad)).toBe(false);
    }
    expect(isSafeSeedPath('issues/slang-1.md')).toBe(true);
  });
});

describe('exportSeed', () => {
  it('carries the WHOLE memory tree, not just imported/', () => {
    const { manifest } = exportFixture();
    const paths = manifest.files.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'index.md',
        'system/index.md',
        'system/definition.md',
        'issues/slang-12197-coercion.md',
        'chains/pr-13213.md',
        'lessons/verify-the-path.md',
        'imported/dossier-old.md',
        'triage-12621.md',
        'repro-slangpy-1059/min.slang',
        'repro-slangpy-1059/f3_loop.cu',
        'fix-10267.patch',
      ]),
    );
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.scope).toBe('memory');
  });

  it('reports what stayed behind and why, and skips binaries', () => {
    const { manifest } = exportFixture();
    expect(manifest.excluded).toEqual(
      expect.arrayContaining([
        { path: '.okf-synth-state.json', reason: 'dotfile' },
        { path: 'imported/MEMORY.md.tmp', reason: 'transient' },
        { path: 'escape-link.md', reason: 'symlink' },
      ]),
    );
    expect(manifest.skipped).toEqual([{ path: 'repro-slangpy-1059/blob.bin', reason: 'non-utf8' }]);
    const shipped = manifest.files.map((f) => f.path);
    for (const gone of [
      '.okf-synth-state.json',
      'imported/MEMORY.md.tmp',
      'escape-link.md',
      'repro-slangpy-1059/blob.bin',
    ]) {
      expect(shipped).not.toContain(gone);
      expect(fs.existsSync(path.join(seedDir(), 'memory', gone))).toBe(false);
    }
  });

  it('scrubs secrets and never writes the raw value into the seed', () => {
    const { manifest } = exportFixture();
    const seeded = fs.readFileSync(path.join(seedDir(), 'memory', 'issues/slang-12197-coercion.md'), 'utf8');
    expect(seeded).not.toContain('glpat-EXAMPLEfakeGitlabToken123');
    expect(seeded).toContain('[REDACTED:gitlab-pat]');
    expect(manifest.redactionsByType['gitlab-pat']).toBe(1);
  });

  it('refuses to overwrite an existing seed without force, and dry-run writes nothing', () => {
    exportFixture();
    expect(() => exportFixture()).toThrow(/already exists/);
    expect(() => exportSeed({ groupsRoot: srcRoot, group: 'slang-triager', out: outRoot, force: true })).not.toThrow();
    const dryOut = path.join(tmp, 'dry');
    exportSeed({ groupsRoot: srcRoot, group: 'slang-triager', out: dryOut, dryRun: true });
    expect(fs.existsSync(dryOut)).toBe(false);
  });

  it('rejects hidden or traversing group names', () => {
    expect(() => exportSeed({ groupsRoot: srcRoot, group: '../x', out: outRoot })).toThrow(/invalid group/);
    expect(() => exportSeed({ groupsRoot: srcRoot, group: '.hidden', out: outRoot })).toThrow(/invalid group/);
  });
});

describe('importSeed', () => {
  it('lays the bundle down at the same relative paths on a fresh target', () => {
    const { manifest } = exportFixture();
    const r = importSeed({ groupsRoot: dstRoot, group: 'slang-triager', seed: seedDir(), scaffoldDir });
    expect(r.applied).toBe(true);
    const dstMem = path.join(dstRoot, 'slang-triager', 'memory');
    for (const f of manifest.files) {
      expect(fs.readFileSync(path.join(dstMem, f.path))).toEqual(
        fs.readFileSync(path.join(seedDir(), 'memory', f.path)),
      );
    }
    // install-local files are not created on the target; provenance is recorded instead
    expect(fs.existsSync(path.join(dstMem, '.okf-synth-state.json'))).toBe(false);
    const prov = JSON.parse(fs.readFileSync(path.join(dstMem, PROVENANCE), 'utf8'));
    expect(prov.sourceGroup).toBe('slang-triager');
    expect(prov.files).toHaveLength(manifest.files.length);
  });

  it('can target a differently-named group', () => {
    exportFixture();
    importSeed({ groupsRoot: dstRoot, group: 'astra-triager', seed: seedDir(), scaffoldDir });
    expect(fs.existsSync(path.join(dstRoot, 'astra-triager', 'memory', 'issues/slang-12197-coercion.md'))).toBe(true);
  });

  it('replaces a still-pristine runtime scaffold without force', () => {
    exportFixture();
    writeTree(path.join(dstRoot, 'slang-triager', 'memory'), {
      'index.md': 'pristine scaffold index\n',
      'system/definition.md': 'pristine scaffold definition\n',
    });
    const r = importSeed({ groupsRoot: dstRoot, group: 'slang-triager', seed: seedDir(), scaffoldDir });
    expect(r.replacedScaffold.sort()).toEqual(['index.md', 'system/definition.md']);
    expect(fs.readFileSync(path.join(dstRoot, 'slang-triager', 'memory', 'index.md'), 'utf8')).toContain(
      'triage slang/slang',
    );
  });

  it('refuses a divergent target file and writes NOTHING, unless force', () => {
    exportFixture();
    const dstMem = path.join(dstRoot, 'slang-triager', 'memory');
    writeTree(dstMem, { 'lessons/verify-the-path.md': 'target-side learning\n' });
    let err: unknown;
    try {
      importSeed({ groupsRoot: dstRoot, group: 'slang-triager', seed: seedDir(), scaffoldDir });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SeedConflictError);
    expect((err as SeedConflictError).conflicts).toEqual(['lessons/verify-the-path.md']);
    expect(fs.existsSync(path.join(dstMem, 'index.md'))).toBe(false);
    expect(fs.readFileSync(path.join(dstMem, 'lessons/verify-the-path.md'), 'utf8')).toBe('target-side learning\n');

    const r = importSeed({ groupsRoot: dstRoot, group: 'slang-triager', seed: seedDir(), scaffoldDir, force: true });
    expect(r.overwritten).toEqual(['lessons/verify-the-path.md']);
  });

  it('skips identical files on a re-import', () => {
    exportFixture();
    importSeed({ groupsRoot: dstRoot, group: 'slang-triager', seed: seedDir(), scaffoldDir });
    const r = importSeed({ groupsRoot: dstRoot, group: 'slang-triager', seed: seedDir(), scaffoldDir });
    expect(r.write).toEqual([]);
    expect(r.skippedIdentical.length).toBeGreaterThan(0);
  });

  it('dry-run validates but writes nothing', () => {
    exportFixture();
    const r = importSeed({ groupsRoot: dstRoot, group: 'slang-triager', seed: seedDir(), scaffoldDir, dryRun: true });
    expect(r.applied).toBe(false);
    expect(r.write.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(dstRoot, 'slang-triager'))).toBe(false);
  });

  describe('rejects a tampered or hostile seed before writing anything', () => {
    const dstExists = () => fs.existsSync(path.join(dstRoot, 'slang-triager'));
    const run = () => importSeed({ groupsRoot: dstRoot, group: 'slang-triager', seed: seedDir(), scaffoldDir });
    const editManifest = (fn: (m: { files: Array<{ path: string }>; schemaVersion: number }) => void) => {
      const p = path.join(seedDir(), MANIFEST);
      const m = JSON.parse(fs.readFileSync(p, 'utf8'));
      fn(m);
      fs.writeFileSync(p, JSON.stringify(m));
    };

    it('a modified file (sha256 mismatch)', () => {
      exportFixture();
      const p = path.join(seedDir(), 'memory', 'chains/pr-13213.md');
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('chain', 'CHAIN'));
      expect(run).toThrow(/sha256 mismatch|byte mismatch/);
      expect(dstExists()).toBe(false);
    });

    it('an undeclared file smuggled into the seed', () => {
      exportFixture();
      fs.writeFileSync(path.join(seedDir(), 'memory', 'extra.md'), 'not in the manifest\n');
      expect(run).toThrow(/undeclared file: extra.md/);
      expect(dstExists()).toBe(false);
    });

    it('a manifest path that traverses or targets install-local state', () => {
      exportFixture();
      editManifest((m) => {
        m.files[0].path = '../../escape.md';
      });
      expect(run).toThrow(/unsafe or install-local path/);
      editManifest((m) => {
        m.files[0].path = '.okf-synth-state.json';
      });
      expect(run).toThrow(/unsafe or install-local path/);
      expect(dstExists()).toBe(false);
    });

    it('a file that still carries secret-shaped content', () => {
      exportFixture();
      const rel = 'triage-12621.md';
      const body = Buffer.from('leaked glpat-EXAMPLEfakeGitlabToken123\n');
      fs.writeFileSync(path.join(seedDir(), 'memory', rel), body);
      editManifest((m) => {
        const f = m.files.find((x) => x.path === rel) as unknown as { bytes: number; sha256: string };
        f.bytes = body.length;
        f.sha256 = crypto.createHash('sha256').update(body).digest('hex');
      });
      expect(run).toThrow(/still contains secret-shaped content/);
      expect(dstExists()).toBe(false);
    });

    it('an old-schema seed', () => {
      exportFixture();
      editManifest((m) => {
        m.schemaVersion = 1;
      });
      expect(run).toThrow(/schemaVersion 1 is not 2/);
    });

    it('an empty seed unless allowEmpty', () => {
      exportFixture();
      editManifest((m) => {
        m.files = [];
      });
      fs.rmSync(path.join(seedDir(), 'memory'), { recursive: true, force: true });
      fs.mkdirSync(path.join(seedDir(), 'memory'));
      expect(run).toThrow(/declares 0 files/);
    });
  });
});
