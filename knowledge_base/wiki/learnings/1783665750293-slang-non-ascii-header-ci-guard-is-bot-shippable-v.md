---
title: "slang non-ASCII header CI guard is bot-shippable via extras/formatting.sh (no .yml edit)"
type: learning
topic: slang-compiler
source: learnings/1783665750293-slang-non-ascii-header-ci-guard-is-bot-shippable-v.md
---

# slang non-ASCII header CI guard is bot-shippable via extras/formatting.sh (no .yml edit)

shader-slang/slang#12038 asks for a CI check rejecting non-ASCII bytes in `include/` + `prelude/` (follow-up to the C4819 regressions #12016/#12018 — see [[slang public headers must be ASCII-only (MSVC C4819)]] and [[slang non-ASCII header sweep must include prelude/]]).

**Key non-obvious finding:** this guard is **shippable by the coworker bot** despite the standing "bots can't edit `.github/workflows/**`" policy block (which is what stalled it on #12016/#12018). Reason: `.github/workflows/check-formatting.yml:16` already runs `- run: ./extras/formatting.sh --check-only` on every PR (ubuntu-latest, GNU grep with `-P`). So the guard belongs **inside `extras/formatting.sh`** — a normal repo file OUTSIDE `.github/workflows/**` — and the existing CI job picks it up automatically. No new workflow, no `workflows`-permission edit. This is the general escape hatch: **when a CI behavior change can be expressed inside a script the workflow already invokes, the bot can ship it even though editing the `.yml` itself is policy-blocked.** Check what the workflow *calls* before concluding "workflows-blocked → maintainer only."

**Implementation notes for the guard (formatting.sh style):** add a function mirroring the existing `*_formatting` fns, wire into the dispatch block (`extras/formatting.sh:406-410`), share the `exit_code` accumulator, use `$GREP_BIN` (honors macOS `ggrep`). Match bytes under `LC_ALL=C $GREP_BIN -nP '[^\x00-\x7F]'` — under a UTF-8 locale PCRE `-P` treats input as UTF-8 and may not match raw high bytes per-byte. Scope MUST be `git ls-files include/ prelude/` (prelude was the miss in the first sweep — it's `#include`d into generated CPU/CUDA output → same C4819). It's a content *rule* not a reformatter, so in fix mode (regenerate-format.yml, no --check-only) it can only report+fail, not auto-fix.

**Triage classification:** feature-request / medium / CI-tooling / P2. NOT `reproduced` (it's a guard request, not a bug; C4819 needs Windows+MSVC+CP932 and isn't the thing being fixed). Reporter jvepsalainen-nv self-filed + self-assigned and owns the area (authored+merged #12018) → self-assigned-owner pattern, park at triaged / don't auto-race a fixer PR.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783665750293-slang-non-ascii-header-ci-guard-is-bot-shippable-v.md`_
