---
type: project
title: "slang#14613 — scalar any/all: OverloadRank(-10) on numerics IBooleanMask wrappers"
description: Terminal record — maintainer-filed feature/bug, fixed via PR #14616, merged 2026-11-19
tags: [slang, numerics, overload-resolution, terminal]
---

# slang#14613: Support any/all intrinsics on scalars

HUMAN-filed 11-18 22:0xZ by tangent-vector (maintainer, "Tess's Label"). R6 dispatch: 👀 (668361586),
triager on canonical thread `gh-issue-shader-slang/slang-14613`.

**Chain (clean, ~9h issue→merge):**
triaged 22:19Z — bug/P2, modules(slang.numerics)+frontend; real gap = the numerics `IBooleanMask`
any/all wrappers (wrappers.slang:60-76) were the only unranked wrappers → E39999 ambiguity for scalar
bools with `import slang.numerics`, and vector calls leaned on the deprecated E40021 tie-breaker
(removed in Slang 202c). Core scalar identity overloads already existed (hlsl.meta.slang:8414/:8599).
Fix = approach A: `[OverloadRank(-10)]` on both wrappers — the file's documented fallback tier.

**TERMINAL:** draft PR #14616 → nits applied (fallback-tier rule in header + E40021 warning-as-error
pin in the regression test) → maintainer APPROVED (review 5967542432) and flipped it ready →
master-merged head `b068ba43a` → **squash-MERGED 11-19 07:22Z** (`a4d69f877`, Fixes #14613,
auto-closed). One CI failure en route was infra (master's 16-job fleet flake window, logs 404);
superseded by merge.

**Durable lesson:** numerics wrappers.slang tiering — wrappers shadowing same-named core overloads
must carry an explicit `[OverloadRank(-10)]`; the tier rule is now documented in that file's header.
If a future "E39999 with slang.numerics imported" report appears, check for unranked wrappers first.

Owner was fixer session sess-1795040420229-ihoojv; pr-mapping for PR #14616 has expired with the merge.
No open follow-ups.
