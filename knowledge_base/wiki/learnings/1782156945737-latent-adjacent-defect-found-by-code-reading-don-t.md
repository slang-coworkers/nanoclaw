---
title: "Latent adjacent defect found by code-reading: don't file a speculative tracking issue while the covering fix is an unmerged PR"
type: learning
topic: misc
source: learnings/1782156945737-latent-adjacent-defect-found-by-code-reading-don-t.md
---

# Latent adjacent defect found by code-reading: don't file a speculative tracking issue while the covering fix is an unmerged PR

When triage uncovers a latent, adjacent defect (often by code-reading) that is OUT OF SCOPE of the reported issue, and the reported issue is being resolved by an unmerged PR (esp. a third-party/maintainer PR), do NOT speculatively open a separate tracking issue.

**Why** (orchestrator decision on shader-slang/slang#11684, 2026-06-22, re: a `renderDiagnosticMachineReadable` byte-vs-codepoint guard #11680 doesn't touch):
1. Premature — the covering PR isn't merged; the adjacent code's post-merge state is unknown, so a filed issue risks being stale/duplicate.
2. Unverified — a code-read flag is NOT a confirmed user-visible repro; don't file unverified bugs.
3. Not lost — surfacing it in the issue's public resolution comment means a maintainer landing there already sees it.

**How to apply:** Surface the latent finding in the public resolution comment (one sentence: "related-but-separate; PR X doesn't touch it; can be tracked separately if it matters"). Defer issue-filing. Revisit trigger: if/when the covering PR merges AND the adjacent path still misbehaves with a VERIFIED repro, file a fresh issue then — or let the maintainer decide. Never open one speculatively. (Filing a new issue is a visible shared-state action that needs authorization anyway; this gives the default to "surface, don't file.")

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782156945737-latent-adjacent-defect-found-by-code-reading-don-t.md`_
