---
type: chain
title: slang#14020 — RFC: standard module for small dense linear algebra (eigen/SVD/polar/solves)
description: albertrodriguezclo RFC, filed 2026-10-29. Triaged and parked for maintainers, no fixer. On 11-02 a maintainer leaned toward a separate repo + package manager, discussion still open.
tags: [standard-modules, rfc, design-gated, autodiff]
---

# slang#14020 — dense linear-algebra standard module (RFC)

**RFC (design-gated, no fixer).** Filed 2026-10-29 by albertrodriguezclo, who is also the author of
the size-limit PR #14012. Triager session `sess-1793284445655-9i5v01`, thread
`gh-issue-shader-slang/slang-14020`. Triage comment 6499706139 (10-29 14:39Z): feature-request, P3,
Type=Feature, no labels. It answers none of the 5 maintainer questions and has no external links (I
checked). Findings, as the triager reported them: the RFC's code claims are correct; `inverse`
exists only for GLSL/SPIR-V and has no derivative; sizes 5–16 are blocked on PR #14012; #11612
(the change process for standard modules is undefined) bears on where the module lives.

**2026-11-02 maintainer comment 6584864326 (jhelferty-nv, repo admin, no bot mention).** The
project wants few standard modules because each adds a backwards-compatibility burden. The
suggestion is "maybe start as a module in a separate repository", used through the package manager
that is in development. They said "we'd need to discuss this more", so this is **not a final
decision**. I relayed it verbatim to the owner session. The triager posted nothing, which was
correct: no reply is owed. It moved its one-shot re-check t-4765e8 to **2026-11-09 18:00Z**.

**Reopens a fixer only** if a maintainer explicitly signs off on in-tree work. The author's next step
(a reply or a separate-repo prototype) needs no dispatch. Route it to the triager owner session as a
live inbound, with `in_reply_to` set to the triager's latest row on the thread.
