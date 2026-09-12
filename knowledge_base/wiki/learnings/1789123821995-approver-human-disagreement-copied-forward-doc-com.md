---
title: "[approver/human-disagreement] copied-forward doc-comment gap on an attribute alias merged unchanged — lean clear, not OPEN_GAP"
type: learning
topic: review-approval
source: learnings/1789123821995-approver-human-disagreement-copied-forward-doc-com.md
---

# [approver/human-disagreement] copied-forward doc-comment gap on an attribute alias merged unchanged — lean clear, not OPEN_GAP

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789077945059-vdtuvv
written_at: 2026-09-11T10:50:21.995Z
---

# [approver/human-disagreement] copied-forward doc-comment gap on an attribute alias merged unchanged — lean clear, not OPEN_GAP

**Signal source:** shader-slang/slang#12907 (`[OutputTopology]` UpperCamelCase alias). My decision @ 74d80b16c273 = ABSTAIN_POLICY/OPEN_GAP on a `///` doc-comment gap. Human outcome: **merged unchanged** by jkwak-work at that exact commit (merge commit 778e5d9, 2026-09-11), doc comment NOT fixed.

**Both rationales.**
- *My abstain:* the alias's `///` comment lists `triangle_cw`/`triangle_ccw` (rejected for `Stage::Mesh`, the alias's motivating stage; valid only for Hull/Domain), and attribute doc comments ARE rendered into public docs (`DocMarkdownWriter::writeAttribute`) → reachable user-facing inaccuracy → OPEN_GAP under conservative-lean.
- *Human:* shipped as-is. A PR commit titled "Match OutputTopology alias documentation" shows the author **deliberately** made the alias's comment identical to the existing lowercase `[outputtopology]` comment — the goal was cross-spelling consistency, and the maintainer accepted the (pre-existing) topology-value imprecision as non-blocking.

**Transferable calibration (sharpens the OPEN_GAP severity bar).** For the class = *a new attribute alias / spelling whose `///` doc comment is copied forward verbatim from the existing spelling to keep the two consistent*: even though it generates a new public doc page, maintainers treat a copied-forward imprecision as a non-blocking nit and ship it unchanged. Absent an INDEPENDENT signal (a functional bug, a NEW inaccuracy the alias introduces that the original didn't have, or a reviewer explicitly requesting the doc fix), lean **clear-advisory**, not OPEN_GAP. Reserve OPEN_GAP for doc gaps that are (a) newly-introduced misinformation not present on the mirrored original, or (b) tied to a real functional/behavioral consequence. The "rendered into public docs" fact (still true — see the sibling `[approver/critique-mustfix]` learning) raises it above zero, but a faithful copy-for-consistency does not clear the "human must look" bar on its own.

**Note on scoring.** ABSTAIN_POLICY rows are excluded from agreement scoring, so this is not a scored false-safe; it is a conservatism-calibration data point. The pattern to watch: an abstain that a human immediately merges past unchanged is a signal the gap was over-weighted.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789123821995-approver-human-disagreement-copied-forward-doc-com.md`_
