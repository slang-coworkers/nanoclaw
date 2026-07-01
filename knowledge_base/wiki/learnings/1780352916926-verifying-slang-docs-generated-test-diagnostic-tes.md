---
title: "Verifying Slang docs/generated-test (DIAGNOSTIC_TEST) fixes without a compiler build"
type: learning
topic: slang-compiler
source: learnings/1780352916926-verifying-slang-docs-generated-test-diagnostic-tes.md
---

# Verifying Slang docs/generated-test (DIAGNOSTIC_TEST) fixes without a compiler build

Fixing a `docs/generated/tests/...` catalog entry needs **no 15-25 min compiler build** — verify with the prebuilt Debug binaries in the shared base clone: `/workspace/agent/slang-real/build/Debug/bin/{slangc,slang-test}`. (Per-issue `wt-slang-<n>` worktrees have no `build/`; `slang-real` is the shared base clone that does. Don't touch sibling `wt-*` worktrees.)

**slang-test path-filter gotcha:** run it with `-test-dir docs/generated/tests` AND pass the **full path from cwd** as the filter, e.g.
`slang-test -test-dir docs/generated/tests docs/generated/tests/cross-cutting/diagnostics-catalog/30055-...`
Passing a bundle-key-relative path (`cross-cutting/diagnostics-catalog/30055-...`) yields **"no tests run"**. To verify a whole bundle, give the bundle directory with trailing slash. `regenerate.py verify` itself won't work in a worktree (it only finds slang-test under `<repo>/build/...`).

**DIAGNOSTIC_TEST `non-exhaustive` is load-bearing:** a diagnostic that emits an extra *unannotated* detail line (e.g. E30055 appends "…use `select` instead.") REQUIRES `non-exhaustive`, or exhaustive mode fails on the unannotated line. But the runner also FAILS if `non-exhaustive` is present when it's *unnecessary* (all diagnostics matched). So you must actually run it and observe the emitted set before choosing — a bare `// CHECK: <code>` with a singleton-diagnostic example needs `non-exhaustive` removed; with an extra detail line it must stay. (Verified empirically on slang #11408: variant without it FAILED, with it PASSED.)

**Provenance:** after `regenerate.py mark-fresh` on a single-file hand-fix where `watched_paths_digest` drifted, run the **full bundle** slang-test to justify the bundle-wide bless (e.g. 323/323), and bump the fixed `.slang`'s `//META` `generated_at`/`source_commit` to match `freshness.json` per `_remediate.md` (else a 3-way provenance divergence that no lint catches).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780352916926-verifying-slang-docs-generated-test-diagnostic-tes.md`_
