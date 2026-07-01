---
title: "Agentic-test bundle staleness is often compiler-driven and list-stale won't catch it"
type: learning
topic: slang-compiler
source: learnings/1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md
---

# Agentic-test bundle staleness is often compiler-driven and list-stale won't catch it

## slang #11700 — regenerating stale `docs/generated/tests/` bundles after diagnostic/IR changes

When the nightly **Agentic Tests** suite (`docs/generated/tests/`) goes red on stale auto-generated bundles, the root cause is frequently a **compiler diagnostic/IR improvement**, not the test docs changing. Key facts for triage:

- **`regenerate.py list-stale` will NOT flag these.** Its digests watch the source *docs* (`source_doc`), which didn't change. Compiler-driven staleness must be diagnosed and regenerated explicitly. Don't rely on `list-stale` to find them.
- **No-hand-edit policy (regenerate.md "Hand-edit policy").** `.slang` files and `README.md` under `docs/generated/tests/<key>/` are **no-hand-edit** (each file carries `//META: warning=Auto-generated... Do not edit by hand.`). The sanctioned fix is to re-prompt the per-bundle generation agent (per-section prompt + source doc) and run `regenerate.py mark-fresh <bundle>`. Patching CHECK lines by hand violates policy and desyncs `freshness.json` digests. Phase D `mark-reviewed`/`mark-remediated` driver hooks are still stubbed.
- **The skip and the fix are two artifacts.** The "skip to green the nightly" edits `expected-failures.txt` (often a separate open PR); the tracking issue then asks for regeneration + entry removal. Check whether the skip entries are already on master or still in an open PR — removals must coordinate with the skip PR's merge.

### Two failure-mode classes seen here
1. **Diagnostic-text drift** — e.g. PR #11656 changed generic-spec failures from `E39999` to focused `E30442 cannot deduce generic argument...`; PR #11576 added per-candidate `note[E40011] candidate:` / `note[E40018] argument N does not match`. **Exhaustive** `DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` bundles fail on the new *unannotated* notes; `non-exhaustive` ones fail when the specific code disappears. Reproduce directly with `build/Release/bin/slangc <bundle>.slang`.
2. **IR-LABEL mangled-name drift** — moving a constructor/method from a `struct` into an `extension` block changes its IR nameHint (drops the type qualifier): e.g. coopvector `__init` `%CoopVecx5Fx24init` (`CoopVec.$init`) → `%x24init` (`$init`) after PR #11480 ("Make native CoopVec differentiable", da319e61a) relocated `__init<each U>` to `extension CoopVec<T,N>`. Benign/intentional.

### Watch for never-correct generated CHECKs
A generated `IR:`/`CHECK` line can be an **LLM hallucination that was never correct** — independent of any compiler change. Here `// IR: makeCoopVector(%_,%_,%_,%_)` was wrong from creation: the variadic `__init<each U>` constructor has always lowered to the distinct `makeCoopVectorFromValuePack` opcode (`slang-ir-insts.lua:993-994`), so the CHECK would have failed even at the test's own `source_commit`. When confirming "is the new IR intentional?", also sanity-check whether the *old* annotation was ever right.

### Routing
These are **not-compiler-code** test-infra chores and are often **self-assigned to the suite owner** (who runs regenerate.py). Triage should verify+classify and post the GitHub verdict, but the regeneration itself is operator-driven and may be owner work rather than a slang-fixer code change.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md`_
