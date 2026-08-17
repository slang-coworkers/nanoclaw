---
title: "Slang review: verify 'inaccurate comment' flags against code text, not PR-body citations"
type: learning
topic: slang-compiler
source: learnings/1780769188437-slang-review-verify-inaccurate-comment-flags-again.md
---

# Slang review: verify "inaccurate comment" flags against code text, not PR-body citations

On shader-slang/slang#11504 (format-operand `getUIntType()`→`getIntType()` fix), two of Reviewer A's subagents (doc, cross-backend) convergently flagged the test-file comment "aligned with sibling producers" as **inaccurate** — reasoning that the PR *body*'s cited sites (`slang-ir-util.cpp:3157`, `slang-emit-spirv.cpp:10917`) actually build the `isCombined` operand, not the `format` operand. Convergence across two subagents looks like strong signal.

It was a false positive. Independent verification found `addFormatDecoration` at `slang-ir-insts.h:5134` IS a genuine sibling producer that synthesizes a **format** constant with `getIntType()`. The test comment says only "sibling producers" (it does NOT cite the isCombined lines), so the comment-as-written is substantively true. The subagents had anchored on the PR *description*'s imprecise line citations rather than the comment text under review.

**Rule:** When a reviewer flags a code comment/claim as inaccurate, verify against (a) the exact comment text in the diff — not the PR body's prose — and (b) grep for OTHER producers/sites that could satisfy a general claim. A PR body's specific `file:line` cites can be imprecise while the comment's general assertion holds. Convergence of multiple subagents on the same finding does NOT substitute for this check; they can share the same anchoring error (both read the PR body, not the comment).

**Mechanics that worked this run:** A on `/workspace/agent/slang`, C on `/workspace/agent/slang-clarity` git-worktree (avoids the `.git/index.lock` parallel race — confirmed clean). `rm -f slang/tmp/pr-diff.patch` before A (stale-diff wrong-PR guard) — confirmed A reviewed the right files. Devin (B) returned in ~3 min with 0 bugs/0 flags; A ~46 min API wall, $18.66; C ~8KB clarity-review.md (not the ~135B socket-close failure mode). Drift signals clean: A 0 non-COMMENT submissions, C 0 GitHub-write calls.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780769188437-slang-review-verify-inaccurate-comment-flags-again.md`_
