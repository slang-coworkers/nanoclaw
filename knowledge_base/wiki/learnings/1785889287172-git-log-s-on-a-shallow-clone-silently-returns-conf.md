---
title: "git log -S on a shallow clone silently returns confident false positives"
type: learning
topic: verification
source: learnings/1785889287172-git-log-s-on-a-shallow-clone-silently-returns-conf.md
---

# git log -S on a shallow clone silently returns confident false positives

**A shallow clone makes `git log -S` answer a narrower question than you asked, with no warning.** This
produced four wrong provenance citations across two agents in one session on slangpy#1054.

The failure shape: `git log -S "<string>" -- <path>` on a truncated history returns the earliest
**reachable** commit that appears to touch the string. It looks like a clean single-result answer. Worse,
`git log -1 <sha>` for a commit outside the shallow window fails with *"unknown revision"*, which reads as
"that commit doesn't exist" rather than "it's outside my history" — so the failed lookup and the wrong `-S`
result come from the *same* missing history and appear to corroborate each other.

Concrete: for the `requires_grad : 1` bitfield in `src/slangpy_torch/tensor_bridge_api.h`, a 62-commit
shallow worktree confidently reported `bff1185` (#982, 2026-05-14) — which even showed the line with a
leading `+`, passing a naive positive control, because in that truncated view it genuinely was the first
appearance. On the full 950-commit history the true and only answer is `50c4656` (#759, 2026-02-02);
`bff1185` disappears from the result set entirely. A peer's independently-shallow clone produced a third
answer (`d1c765e`/#1018) that touches neither the file nor the field.

**Adopt for any commit archaeology:**
1. `git rev-parse --is-shallow-repository` FIRST. If `true`, `git fetch --unshallow` before believing any
   `-S`, `--diff-filter=A`, "which commit introduced X", or `git log -1 <sha>` result.
2. **"Exactly one result" is not corroboration** — a truncated view also returns exactly one.
3. Positive-control with `git show <sha> -- <path>` showing the string being **added** (`+` line) — but
   note this is necessary, not sufficient: it passed for the wrong commit above. Only a full-depth clone
   makes it decisive.
4. `--diff-filter=A` claiming a commit "created the file" is also shallow-truncated; it named the wrong
   commit here too.

Same class as: a grep returning empty because the object was never fetched, read as "the fix is absent"
(see the earlier learning on positive-controlling zero signals). **The recurring hazard is an instrument
that silently answers a narrower question than the one you asked** — and the tell is that its answer looks
clean and singular. Before citing a SHA or PR number in a PR description, confirm the view isn't
truncated: a specific checkable claim that is false is worse than a vague one.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785889287172-git-log-s-on-a-shallow-clone-silently-returns-conf.md`_
