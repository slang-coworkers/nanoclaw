/**
 * Guards the vendored claude-trace build in container/claude-trace/.
 *
 * The build is committed on purpose so a deploy needs no node build. But the
 * repo's blanket `dist/` .gitignore rule swallowed it on the first attempt, and
 * that failure is INVISIBLE at runtime: resolveClaudeTraceDir() finds no
 * dist/cli.js, returns null, and tracing is silently off on every box. Nothing
 * errors, no trace is written, and the first symptom is an empty directory
 * somebody notices weeks later.
 *
 * So: assert the files a checkout must actually contain.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const DIR = path.join(__dirname, 'claude-trace');

describe('vendored claude-trace', () => {
  it('ships dist/cli.js — the file the whole feature gates on', () => {
    expect(existsSync(path.join(DIR, 'dist', 'cli.js'))).toBe(true);
  });

  it('ships the frontend assets used to render the .html viewer', () => {
    expect(existsSync(path.join(DIR, 'frontend', 'dist', 'index.global.js'))).toBe(true);
    expect(existsSync(path.join(DIR, 'frontend', 'template.html'))).toBe(true);
  });

  it('ships the wrapper CLAUDE_CODE_EXECUTABLE points at', () => {
    const wrapper = path.join(DIR, 'claude-trace-wrapper.sh');
    expect(existsSync(wrapper)).toBe(true);
    // It must invoke the MOUNTED dist, not a global claude-trace — the whole
    // point is that the patched build runs, not the stock npm one.
    expect(readFileSync(wrapper, 'utf-8')).toContain('dist/cli.js');
  });

  it('keeps the patch as the source of truth for the fork', () => {
    expect(existsSync(path.join(DIR, '0001-nvidia-bedrock-interception.patch'))).toBe(true);
  });

  it('is the PATCHED build, not stock upstream', () => {
    // Stock claude-trace only intercepts anthropic.com, so it silently records
    // nothing against inference-api.nvidia.com. If this fails, someone has
    // replaced the build with the npm package and every trace will be empty.
    const files = ['dist/cli.js', 'dist/interceptor.js']
      .map((f) => path.join(DIR, f))
      .filter((f) => existsSync(f))
      .map((f) => readFileSync(f, 'utf-8'));
    expect(files.join('\n')).toContain('nvidia.com');
  });
});
