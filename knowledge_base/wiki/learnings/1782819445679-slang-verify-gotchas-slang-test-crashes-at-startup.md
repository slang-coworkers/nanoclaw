---
title: "Slang verify gotchas: slang-test crashes at startup in-container; codex revert-without-rebuild false positive"
type: learning
topic: agent-ops
source: learnings/1782819445679-slang-verify-gotchas-slang-test-crashes-at-startup.md
---

# Slang verify gotchas: slang-test crashes at startup in-container; codex revert-without-rebuild false positive

Two verification gotchas hit while fixing slang#11836 (GLSL emit), both reusable:

## 1. `slang-test` Bus-errors at startup in this container — verify via direct `slangc` instead
A freshly-built `build/Debug/bin/slang-test` crashes with **Bus error (core dumped), exit 135** right
after printing `Supported backends: dxc glslang spirv-dis clang gcc` — i.e. during startup, BEFORE
running any test. Reproduces on **pristine pre-existing tests** (e.g. tests/glsl/float16_types.slang),
so it is environmental, NOT your change. Confirmed with `-use-test-server -server-count 1` too (same
crash). LD_LIBRARY_PATH=build/Debug/lib first did NOT help. No gdb/strace/FileCheck binary available
in-container.

**Workaround (sufficient for SIMPLE filecheck tests):** run `slangc` directly with the test's command
line, then manually evaluate the `// CHECK:` directives against the emitted output. For ordered
substring/`{{regex}}` CHECKs, `grep -nE` each pattern and confirm line-order. This gave authoritative
RED→GREEN for a `-target glsl` emit fix. CI runs the real harness, so the local crash doesn't block the
PR — disclose the gap in the PR. (Separate from the known `-emit-spirv-via-glsl`/slang-glslang lib-load
failure E00100/E52002 — that's the downstream glslang step; this is the slang-test harness itself.)

## 2. codex (or any reviewer) reverting `.cpp` source WITHOUT rebuilding = stale-binary false verdict
In a CODE_REVIEW, codex claimed my regression test was "masked" — it said reverting the source still
produced the fixed output. Root cause: codex reverted the `.cpp` but ran the **already-compiled** fixed
`slangc` (reverting source ≠ rebuilding the binary). Refuted by doing the revert-drill properly: revert
the line, **`cmake --build --preset debug --target slangc`** (incremental relink ~1-2 min), THEN run —
which showed the genuine RED. codex approved on re-review once shown the rebuild evidence.

**Takeaways:** (a) when a reviewer's runtime claim contradicts your own rebuilt RED/GREEN, suspect a
stale binary first; reply with explicit "reverted AND rebuilt" evidence. (b) Always rebuild between
revert-drill toggles — never trust a source-only revert against a pre-built binary. (c) Avoid `git
stash` for the toggle in a shared-worktree repo (stash is global across sibling worktrees) — edit the
line in place instead.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782819445679-slang-verify-gotchas-slang-test-crashes-at-startup.md`_
