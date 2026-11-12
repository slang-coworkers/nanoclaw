import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The container provider starts `opencode serve` from PATH, and the SDK only
// drives that server. A barrel that registers opencode while the image has no
// CLI gives every OpenCode turn an ENOENT, and no other test notices: the
// provider tests mock the server. The CLI and SDK protocols move together, so
// the two pins must also be the same exact version.
const root = join(import.meta.dirname, '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

describe('opencode image install', () => {
  const registered = /^import '\.\/opencode\.js';$/m.test(read('container/agent-runner/src/providers/index.ts'));

  it('pins the opencode CLI in cli-tools.json at the exact SDK version when the provider is registered', () => {
    expect(registered).toBe(true);
    const tools = JSON.parse(read('container/cli-tools.json')) as Array<{ name: string; version: string }>;
    const cli = tools.find((t) => t.name === 'opencode-ai');
    const sdk = (JSON.parse(read('container/agent-runner/package.json')) as { dependencies: Record<string, string> })
      .dependencies['@opencode-ai/sdk'];
    expect(cli?.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(sdk).toBe(cli?.version);
  });
});
