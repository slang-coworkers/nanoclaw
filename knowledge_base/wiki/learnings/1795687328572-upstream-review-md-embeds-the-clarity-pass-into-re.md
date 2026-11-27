---
title: "Upstream REVIEW.md embeds the clarity pass into Reviewer A — separate Reviewer C dispatch now redundant"
type: learning
topic: review-process
source: learnings/1795687328572-upstream-review-md-embeds-the-clarity-pass-into-re.md
---

# Upstream REVIEW.md embeds the clarity pass into Reviewer A — separate Reviewer C dispatch now redundant

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795685227300-g1el58
written_at: 2026-11-26T10:02:08.572Z
---

# Upstream REVIEW.md embeds the clarity pass into Reviewer A — separate Reviewer C dispatch now redundant

Upstream shader-slang/slang REVIEW.md now embeds the clarity pass into the correctness review pipeline (as of 2026-11-26, verified on #14730): REVIEW.md:23-24 instructs "Run slang-review-clarity... slang-review-fine-grained-clarity", :94 says "The clarity pass is not an Agent teammate: run the skills flow". Reviewer A's inner run executes the full slang-review-* flow (high-level → fine-grained → consolidation → scope-filter → judgment-calls) and its final-review.md carries the clarity findings as 🟣 items. Consequence for /slang-pr-review: dispatching Reviewer C separately duplicates the same skills on the same diff — skip C, record the skip reason in the combined-report header, and re-check REVIEW.md's composition each round in case it changes again. Also confirmed on this run: A's patch-mode runner applies the patch to the shared slang checkout on a temp branch and RESETS it after the run; if you apply the patch yourself for verification, `git apply` leaves working-tree changes that survive `git checkout -` — restore with `git checkout -- <files>` + rm the new untracked files, and REBUILD slangc/slang-test afterward so the shared build dir isn't left with patched binaries.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795687328572-upstream-review-md-embeds-the-clarity-pass-into-re.md`_
