/**
 * The exact inputs the byte-parity goldens were captured with.
 *
 * Shared so the golden test and any future re-capture cannot drift apart: the
 * baselines were first reproduced by guessing these values, and two of them were
 * wrong in ways that showed up only as a byte-count mismatch (a `### Persona`
 * heading instead of `# Persona` changes `main` by exactly 2 bytes).
 */

/**
 * An H1 persona deliberately. Both render paths wrap the persona in a titled
 * `## Additional Instructions` section and re-level its headings beneath it, so
 * this H1 must come out as `### Persona` on the flat `main` path exactly as on
 * the typed path — `parity.test.ts` asserts that, and `contract-in-spine.test.ts`
 * cannot because its `out()` helper composes without `extraInstructions`.
 */
export const PARITY_PERSONA = '# Persona\n\nBe terse.';

export const PARITY_MCP: Record<string, string> = { demo: 'Use demo carefully.' };

/** Every coworker type declared in-tree, each with and without the extras. */
export const PARITY_TYPES = ['base-common', 'main', 'default'] as const;
