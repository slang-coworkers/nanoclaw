/**
 * Guards the spinner failure glyph.
 *
 * Six setup failure paths called `s.stop(msg, 1)`, intending the red outcome
 * marker. Clack's `stop` hard-codes the success code and DISCARDS any second
 * argument, so every one of them rendered a failed step with the green ◇ — a
 * setup that could not reach OneCLI, could not install a provider, or timed out
 * waiting for the agent all looked like they had succeeded.
 *
 * It survived because `tsc` reported it (TS2554, "Expected 0-1 arguments, but
 * got 2") and nothing ever ran `tsc` over `setup/**` — the project tsconfig is
 * `include: ["src*"]`. So this file guards both halves: the library contract
 * that makes the pattern wrong, and the absence of the pattern in the tree.
 */
import { describe, it, expect } from 'vitest';
import * as p from '@clack/prompts';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Everything clack writes to stdout while `fn` runs. */
function capture(fn: () => void): string {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((c: string | Uint8Array) => {
    chunks.push(typeof c === 'string' ? c : Buffer.from(c).toString('utf8'));
    return true;
  }) as typeof process.stdout.write;
  try {
    fn();
  } finally {
    process.stdout.write = orig;
  }
  return chunks.join('');
}

function render(act: (s: ReturnType<typeof p.spinner>) => void): string {
  return capture(() => {
    const s = p.spinner();
    s.start('working…');
    act(s);
  });
}

/** The outcome marker clack emitted, independent of colour (CI is not a TTY). */
function glyph(out: string): string {
  const m = out.match(/[◇■▲]/g);
  return m ? m[m.length - 1] : '';
}

describe('clack spinner outcome contract', () => {
  it('stop() ignores a second argument — the reason s.stop(msg, 1) was wrong', () => {
    // If clack ever gives `stop` a code parameter, this fails and the comments
    // in runner.ts / auto.ts / tz-from-claude.ts should be revisited.
    const withCode = render((s) => (s.stop as (m: string, c: number) => void)('done', 1));
    const withoutCode = render((s) => s.stop('done'));
    expect(glyph(withCode)).toBe(glyph(withoutCode));
    expect(glyph(withCode)).toBe('◇');
  });

  it('error() and cancel() render a distinct, non-success marker', () => {
    expect(glyph(render((s) => s.error('nope')))).toBe('▲');
    expect(glyph(render((s) => s.cancel('nope')))).toBe('■');
    expect(glyph(render((s) => s.error('nope')))).not.toBe('◇');
  });
});

/** Every `<something>.stop(...)` call site with more than one argument. */
function overArgumentedStopCalls(file: string): number[] {
  const src = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf-8'),
    ts.ScriptTarget.ES2022,
    true,
  );
  const hits: number[] = [];
  const walk = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'stop' &&
      n.arguments.length > 1
    ) {
      hits.push(src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1);
    }
    ts.forEachChild(n, walk);
  };
  walk(src);
  return hits;
}

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.ts')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

describe('no spinner call passes a discarded outcome code', () => {
  it('setup/ and src/ are free of `.stop(msg, <code>)`', () => {
    // An AST walk rather than a regex: the original tz-from-claude.ts call put
    // its `1` four lines below the `.stop(`, which no line-wise grep would see.
    const offenders: string[] = [];
    for (const dir of ['setup', 'src']) {
      for (const file of tsFilesUnder(path.join(REPO, dir))) {
        for (const line of overArgumentedStopCalls(file)) {
          offenders.push(`${path.relative(REPO, file)}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
