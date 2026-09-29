/**
 * The production gateway registration, asserted at the SOURCE.
 *
 * This exists because a green test suite proved nothing about it. `src/test-setup.ts`
 * calls `resetGatewayProvider(fixture)` in a global `beforeEach`, so every test in the
 * repo runs with a `test-gateway` already in the registry. The real question — does a
 * real boot find a provider? — was therefore unobservable from inside the suite, and
 * 4,992 passing tests coexisted with a host that could not start.
 *
 * That is what happened on 2026-09-27: the upstream gateway-seam merge brought
 * `src/gateway-providers/onecli.ts` into core (it self-registers at its bottom) but left
 * `installed.ts` the comment-only barrel upstream ships, because upstream expects
 * `/add-onecli` to append the import. This fork installs no such skill, so nothing
 * imported the provider, `listGatewayProviderKinds()` returned `[]`, and
 * `configuredGatewayProviderKind()` threw `No gateway provider is registered in this
 * build` — taking prod down into circuit-breaker backoff.
 *
 * Reading the files rather than the registry is the whole point: an assertion against
 * the live registry would be satisfied by the fixture and would keep passing while
 * production wiring is missing. The cost is that this test knows about import syntax;
 * the benefit is that it cannot be fooled by the harness it runs in.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

const DIR = path.join(process.cwd(), 'src', 'gateway-providers');
const BARREL = path.join(DIR, 'installed.ts');

/** Side-effect imports of sibling modules, in `installed.ts`'s own directory. */
function registeredModules(): string[] {
  const source = fs.readFileSync(BARREL, 'utf-8');
  return [...source.matchAll(/^\s*import\s+'\.\/([A-Za-z0-9._-]+)\.js';/gm)].map((m) => m[1]);
}

describe('gateway provider registration (source-level)', () => {
  it('registers at least one provider, so a real boot cannot fail closed', () => {
    expect(
      registeredModules(),
      `${BARREL} imports no provider module. The host throws 'No gateway provider is registered ` +
        `in this build' at startup and refuses to boot. Append \`import './<provider>.js';\`.`,
    ).not.toHaveLength(0);
  });

  it('imports only modules that exist and actually self-register', () => {
    const modules = registeredModules();
    // Guards against a vacuous pass: an empty list would satisfy a bare forEach.
    expect(modules.length).toBeGreaterThan(0);

    for (const name of modules) {
      const file = path.join(DIR, `${name}.ts`);
      expect(fs.existsSync(file), `${BARREL} imports './${name}.js' but ${file} does not exist`).toBe(true);

      // Presence is not wiring — the failure this file exists for was a provider
      // that existed and was never imported. The mirror of that is a provider that
      // is imported and never registers.
      const source = fs.readFileSync(file, 'utf-8');
      expect(
        /registerGatewayProvider\s*\(/.test(source),
        `${file} is imported by the barrel but never calls registerGatewayProvider(), ` +
          `so importing it registers nothing`,
      ).toBe(true);
    }
  });

  it('carries OneCLI specifically, which this fork keeps in core rather than installing', () => {
    // Named rather than left to the generic assertions above: on this fork OneCLI is
    // not optional, and a rename or accidental removal should say so by name.
    expect(registeredModules()).toContain('onecli');
  });
});
