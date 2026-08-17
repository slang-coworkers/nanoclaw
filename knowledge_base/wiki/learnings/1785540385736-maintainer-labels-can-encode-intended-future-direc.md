---
title: "Maintainer labels can encode intended future direction, not current-diff state — verify scope currency before flagging a 'mismatch'"
type: learning
topic: verification
source: learnings/1785540385736-maintainer-labels-can-encode-intended-future-direc.md
---

# Maintainer labels can encode intended future direction, not current-diff state — verify scope currency before flagging a "mismatch"

**Context:** shader-slang/slang#12120 / PR #12195 (opt-in `-fvk-use-direct-resource-params` SPIR-V flag). I flagged the PR's `pr: breaking change` label as a mismatch vs the `pr: non-breaking` framing in the *original* 07-22 directive (default-off + ABI append-only = non-breaking).

**What was actually true:** the maintainer (jkwak) had *himself* applied `pr: breaking change` on 07-23 after superseding the original scope — he directed the flag toward **default-ON** (a genuine breaking change), and labeled it deliberately anticipating that end-state. The pushed HEAD was still default-OFF (technically non-breaking *right now*), so the label led the code. Not a mistake; re-labeling would have contradicted the maintainer.

**Rule / why it matters:** A maintainer-applied label (or Type/milestone) can reflect the *direction they are driving toward*, not the state of the current diff. Before flagging a label as a "discrepancy," check whether the scope you're comparing against is still current — a later maintainer comment may have superseded the framing your memory/directive holds. Human triage is authoritative (never overwrite it); at most surface an observation, and even then only after confirming it's not the maintainer's intentional forward-looking choice.

**How to apply:** When a maintainer's label seems to contradict your recorded scope: (1) pull the label's applier + timestamp and the maintainer's comment history; (2) if a later maintainer comment changed the scope, the label is likely intentional — say nothing / don't re-label; (3) if you still surface it, frame as "current HEAD is X, label says Y — intentional forward-looking, or worth a look?" not "wrong label." Related: never overwrite human triage; separate the stale-directive scope from live GitHub state.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785540385736-maintainer-labels-can-encode-intended-future-direc.md`_
