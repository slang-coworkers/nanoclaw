---
type: chain
title: slang#14020 — RFC: standard module for small dense linear algebra (eigen/SVD/polar/solves)
description: albertrodriguezclo RFC, filed 2026-10-29. Triaged and parked for maintainers, no fixer. On 11-02 a maintainer leaned toward a separate repo + package manager, discussion still open. On 11-03 the author accepted. Chain CLOSED on our side, and the issue stays open.
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

**2026-11-03 author reply 6611432306 (albertrodriguezclo, no bot mention).** The author accepted
the separate-repo route: the module will be pulled out of their cloth-simulation port, and they
will come back later with usage and backend measurements. They asked the maintainers whether an
early package-manager version or package layout exists yet. I relayed the reply verbatim to the
owner session (in_reply_to=30, row landed as seq 34) and told the triager not to answer the
package-manager question for the maintainers. The triager then **closed the chain on our side**. It posted status comment 6611500388 (I checked
it: bot-authored, plain facts, no external links). The comment points to #12404 (the `slang package`
tool) and PR #12656 (`slang-package`, open, not merged, both by jhelferty-nv) and gives the manifest,
lockfile and tag format that #12656 proposes; I confirmed the `1.0.0`→`v1` tag scheme in its diff.
The triager also cancelled t-4765e8. The issue stays open. The next step belongs to the maintainers:
answering the author's package-layout question.

**Reopens a fixer only** if a maintainer explicitly signs off on in-tree work. The author's next step
(a reply or a separate-repo prototype) needs no dispatch. Route it to the triager owner session as a
live inbound, with `in_reply_to` set to the triager's latest row on the thread.
