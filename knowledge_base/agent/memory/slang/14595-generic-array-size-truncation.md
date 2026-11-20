---
type: chain
title: "#14595 array size >INT32_MAX from generic param silently truncated"
description: Park overturned, fixer chain run to draft PR #14601 (stacks under #14509); side-find #14610 filed-only
---

# #14595 chain (2026-11-18)

**Issue:** shader-slang/slang#14595 (skiminki-nv, self-assigned, Diagnostics label) — `float data[N]`
with N a `uint`/`uint64_t` generic value param truncates silently above INT32_MAX when substituted;
author prescribed the fix hook (check at specialized-type checking, not in the `TypeCastIntVal` fold).

**Park overturned:** triager initially parked as maintainer-owned (self-assigned + fix-on-top-of-#14509,
citing #14476). I struck it per operator/1794884111425 (ownership-only hold class; #14476's identical
hold was struck 11-17). Fixer handoff directed with the #14509 sequencing constraint. Triager also
struck its stale `issues/14476.md` note at the source.

**Outcome:** draft PR #14601 (fix/issue-14595, final head 39f8251c0 after reviewer APPROVE_WITH_NITS applied; earlier 8efe701ff, pr: non-breaking, CI green, mergeable)
— E30034/E30025 substituted-size validation at `getTypeForDeclRef`; regression test
tests/diagnostics/array-size-too-large-generic.slang (fails pre-fix, 1407/1407 suites green).
2 REQUEST_CHANGES rounds applied (sentinel boundary; error-recovery SLANG_ASSERT + nested dims).
Stacks under maintainer's in-flight PR #14509 (slang-int-folding); rebase note in PR body.

**Key gotchas:**
- Sentinel boundary: array-size "unsized" marker is **exactly INT32_MAX**, so the check is
  `> 2147483646`, not `> INT32_MAX`. **#14509's own `>` boundary has the same sentinel hole** —
  documented in #14601's PR body for skiminki-nv's rebase.
- Ready-flip ordering: #14601 must wait for #14509 to merge (stacked); maintainer review is the
  human gate. Ready-flip pending → weekly undraft list, NOT a per-PR ask.
- Stand-down sentence retained on issue cmt 6983423985: skiminki-nv may claim it or ask us off.

**Residuals:** (a) #14610 (bot-filed, filed-only, no chain) — declaration-only/layout/reflection
specializations escape the use-site hook; durable home = specialization-creation layer in #14509.
(b) direct-constant `float data[0x100000001]` silent → owned by #14509's declaration-site check.
(c) explicit user cast kept silent (pinned in test, maintainer may veto).

Trail: triager `memory/issues/14595.md` + `triage-14595.md`; supervisor-state entry updated.
