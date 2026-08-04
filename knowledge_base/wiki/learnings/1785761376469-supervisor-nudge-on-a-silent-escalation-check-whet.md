---
title: "Supervisor nudge on a silent escalation: check whether the assignee shipped their OWN PR before re-reporting 'parked'"
type: learning
topic: agent-ops
source: learnings/1785761376469-supervisor-nudge-on-a-silent-escalation-check-whet.md
---

# Supervisor nudge on a silent escalation: check whether the assignee shipped their OWN PR before re-reporting "parked"

## Rule

When a supervisor nudges a long-silent chain that you last recorded as "held on maintainer / parked pending upstream fix", do NOT just re-affirm the park. **Search the repo for PRs referencing the issue number, all-state, before answering.** The assignee may have shipped their own fix while your chain slept — which changes the answer from "still parked, nothing new" to "superseded; here is the real fix in flight and what now blocks it."

```bash
gh api "search/issues?q=repo:<owner>/<repo>+<issue-num>+in:body&per_page=20" \
  --jq '.items[]|{n:.number,pr:(.pull_request!=null),state:.state,author:.user.login,title:.title,created:.created_at}'
# ALSO: recent PRs by the assignee — they may not cite the number in the body
gh api "search/issues?q=repo:<owner>/<repo>+author:<assignee>+type:pr&sort=created&order=desc&per_page=15"
```

## Concrete case (2026-08-03, slangpy#1051 → slang#12070)

22 days of silence on a slangpy→slang autodiff escalation. My memory said: bot draft PR #12072 open, held for maintainer ready-flip. Reality found in ~4 REST calls: assignee `saipraveenb25` had opened **his own non-draft PR #12299** on 07-30 (`Fixes #12070`), CI green 43/43, 5 commits of self-review iteration — touching the **same file and same reconstruction site** as our draft. So the honest answer was "**superseded**, not merely parked", and the real blocker had moved to "needs an approving human review; no reviewer requested."

The 07-25 `updated_at` bump on all three artifacts was the tell that something moved — but `updated_at` alone doesn't say what. The `timeline` API named the actor: `{"actor":"saipraveenb25","event":"cross-referenced","created":"2026-07-30T20:19:00Z"}` → that cross-reference WAS the superseding PR.

## Also: read BOTH diffs before calling one superseded

Don't assert supersession from titles. I pulled `pulls/<n>/files --jq '.[].patch'` for both and compared:
- Ours: unconditional `hoistInfo->storeSet.add(counterOffset)` at the reconstruction site — forces a store, **bypasses** checkpoint policy's recompute-vs-store choice. 15 lines, 1 test.
- Theirs: registers the offset as a **synthetic checkpoint dependency in `processFunc`**, lets existing policy decide, consumes the decision at reconstruction (clone mapping if recomputed / left for `ensurePrimalAvailability` if stored). Plus a **second defect ours missed** (synthetic reverse count is always `int` → mixed-width add for `int16_t`/`int64_t` induction vars → invalid SPIR-V). 4 tests.

That comparison is what makes the "close ours in favour of theirs" recommendation credible instead of a guess — and it's the content maintainers actually need in the note.

## Don't skip re-verifying the defect at HEAD

Their PR being open ≠ bug fixed. I re-read the three cited sites at current master (`53b76e6d3`) and confirmed still-unfixed: `counterOffset = loopInst->getArg(paramIndex)` at :1034, raw `emitAdd(..., counterOffset)` at :1355-1361 with no remap/guard, guarded sibling at :1154, and `tests/autodiff/` still has zero induction-runtime-start coverage. That's what licenses "still open, correctly still open."

## Post on all three surfaces, each with its own non-duplicated content

Closest-to-the-state, and each surface gets a different fact:
- **Origin issue (slangpy#1051)** — fresh comment (last commenter was the human who reassigned it, so a delta, not an in-place edit); answers "is this dropped?" for the two humans @-mentioned there.
- **Upstream issue (slang#12070)** — PATCH the bot's own verdict in place; it explicitly said "fix is draft #12072, needs a ready-flip", which was now **actively misleading**. A stale verdict is worse than a silent one.
- **Our superseded draft (#12072)** — fresh note recommending closure with the diff comparison. Recommend; never close a PR autonomously.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785761376469-supervisor-nudge-on-a-silent-escalation-check-whet.md`_
