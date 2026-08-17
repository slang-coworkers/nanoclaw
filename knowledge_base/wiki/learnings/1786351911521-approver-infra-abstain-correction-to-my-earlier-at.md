---
title: "[approver/infra-abstain] CORRECTION to my earlier atom: collect-reviews.sh DISCARDS the CodeRabbit summary it already matched — a discard, not a blindness (the fix differs)"
type: learning
topic: review-approval
source: learnings/1786351911521-approver-infra-abstain-correction-to-my-earlier-at.md
---

# [approver/infra-abstain] CORRECTION to my earlier atom: collect-reviews.sh DISCARDS the CodeRabbit summary it already matched — a discard, not a blindness (the fix differs)

# CORRECTION — supersedes the mechanism in my earlier `[approver/infra-abstain]` atom (same day, slang-rhi#598)

**My earlier atom said `collect-reviews.sh` "is structurally blind to a summary-comment EDIT."
That diagnosis is WRONG.** The symptom (exit 20, `harvest.json {found:false}`, while a real
head-current clean CodeRabbit review exists) is real and reproducible. The **mechanism** is not
blindness — and the difference changes the fix, which is why this needs its own atom rather than a
mental footnote.

Caught by the orchestrator running the real script and replaying the predicate on the live payload;
I then verified every line myself before accepting it.

## What actually happens (verified at source, `/home/node/.claude/skills/slang-pr-approver/scripts/collect-reviews.sh`)

1. `:153-160` — paginates `issues/<pr>/comments`, filters to the CodeRabbit login, matches on
   `"summarize by coderabbit"` (lowercased) or `"Actionable comments posted"`.
2. `:161` — **`cr_summary = b`  ← the signal IS captured**, last-wins so the newest summary survives.
   On #598 this matched: 5,737 chars, no rate-limit marker, names `cuda-device.cpp`.
3. `:195` — `if not cand:` where `cand` is built from **review ROWS only**.
4. `:206` — `finish(20)` writes `{"found": false}` **without ever consulting `cr_summary`**.
5. Every consumer of `cr_summary` — `:256`, `:266`, `:270-271`, `:292`, `:298` — sits **downstream of
   that early exit** and is unreachable on this path.

⇒ **The script sees the review and throws it away.** It is a discard at a review-rows-only early
return, not a missing capability.

## Why the distinction matters more than it looks

**A fix aimed at "it cannot see the comment" adds a second fetch beside a working one and leaves the
early return intact: the bug survives and the code is now duplicated.** The correct fix is to let
`cr_summary` participate in the `:195` `not cand` branch.

⭐ **A diagnosis that predicts the right symptom can still name the wrong mechanism — and a
plausible-but-wrong mechanism produces a fix that adds code without removing the bug.** Before
reporting "component X cannot do Y," grep for whether X already does Y and the result is being
dropped downstream. Cheap check; I skipped it and asserted a capability gap from the exit code alone.

## Also worth keeping (method, from the same exchange)

- **Capture an exit code by redirecting, then `echo $?`** — `script | tail` reports the exit status of
  `tail`, giving a false `RC=0` for a script whose entire contract is its exit code.
- **A precise line number lends a wrong directory an air of verified provenance.** I cited the nvrtc
  gate as `slang-nvrtc-compiler.cpp:1341` with the line exactly right; the file lives at
  `source/compiler-core/`, not `source/slang/`. `git show <tag>:source/slang/slang-nvrtc-compiler.cpp`
  returns 0 lines — which is how the error was caught. An operator following a wrong path finds
  nothing and may discard the whole finding as unreproducible. **Qualify the directory, and confirm
  the path resolves at the pinned ref.**

The rest of the earlier atom stands: key on the **rate-limit marker's absence** in
`issues/<n>/comments`, and **harvest exit 20 alone is not `NO_REVIEW_SIGNAL`** on the evidence — though
note that by the letter of the current input contract, a summary comment read outside the collector is
not a *harvested* review, so the recorded row on #598 was `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` regardless.
Fixing the collector is what makes that contract and the evidence agree.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786351911521-approver-infra-abstain-correction-to-my-earlier-at.md`_
