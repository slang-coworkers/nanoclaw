---
title: "ASan 'runtime does not come first' CI flake — diagnosis, fix levers, and the GH Actions success() trap"
type: learning
topic: ci-tooling
source: learnings/1782802321817-asan-runtime-does-not-come-first-ci-flake-diagnosi.md
---

# ASan "runtime does not come first" CI flake — diagnosis, fix levers, and the GH Actions success() trap

> **⚠️ SUPERSEDED 2026-07-13 by [[1782802481315-correction-to-asan-runtime-not-first-learning-the-]]** — that note corrects this one: the LD_PRELOAD guard belongs in the static canary too (it IS the gating step), not only the dynamic test steps. Follow the newer note.

# ASan "runtime does not come first" CI flake — diagnosis, fix levers, and the GH Actions success() trap

Context: shader-slang/slang#11831 — `sanitizer-linux-clang-x86_64` intermittently aborts with
`ASan runtime does not come first in initial library list` on the GCP runner pool (~1/35, one bad VM).

**Diagnosis lever:** if the **static-asan** canary ALSO hits that abort (not just the dynamic
`-shared-libsan` test binaries), the cause is almost certainly a VM-global preload — `/etc/ld.so.preload`
or env `LD_PRELOAD`. Only a loader-level preload can get a library *ahead of* a statically-linked-asan
main executable in the initial library list. So: static-canary-aborts ⇒ infra/VM root cause, not a
Slang code or workflow defect.

**Fix levers (Linux/clang ASan):**
- Force ASan first WITHOUT disabling the check: `export LD_PRELOAD="$(clang-18 -print-file-name=libclang_rt.asan-x86_64.so)"`
  (loader processes LD_PRELOAD env entries before /etc/ld.so.preload). Preferred — keeps the link-order check live.
- `ASAN_OPTIONS=verify_asan_link_order=0` (or a weak `__asan_default_options()` in source) DISABLES the
  check — a mask; rejected. And a source-level `__asan_default_options()` won't fix a standalone canary
  binary that doesn't link your source.
- Do NOT LD_PRELOAD the *dynamic* asan runtime onto a *static*-asan binary → "incompatible ASan runtimes".
  Make linkage uniform (`-shared-libsan`) if you want one preload to cover both.
- cmake static-linkage (drop `-shared-libsan`) is the WRONG fix: clang static asan is incompatible with
  `-Wl,--no-undefined` (documented in slang cmake/CompilerFlags.cmake), and static linkage doesn't immunize
  against an /etc/ld.so.preload injection anyway.

**GH Actions trap (cost me a wrong primary in the triage):** a step `if:` that does NOT use a status
function (e.g. `if: steps.build.outcome == 'success'`) gets an *implicit* `success()` AND-wrapper. So once
an earlier step fails, all later such conditional steps are SKIPPED. Consequence: if your earlier *canary*
step is the one aborting, patching the *later test steps* does nothing — the canary already failed the job
and skipped them. Always identify WHICH step actually fails before scoping a CI fix.

**Routing:** a CI flake whose only robust fixes are workflow-YAML (bot has no `workflows` App perm →
can't push `.github/workflows/*`) + infra VM hygiene (out of repo) is NOT bot-PR-able. Deliverable =
diff-as-comment for a maintainer + infra handoff, not a PR.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782802321817-asan-runtime-does-not-come-first-ci-flake-diagnosi.md`_
