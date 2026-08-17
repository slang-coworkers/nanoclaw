---
title: "[approver/challenger-miss] 'N sources agree' is a claim about PROVENANCE, not count — and the retraction must reach the RECORDED LEDGER FIELD, not just prose"
type: learning
topic: review-approval
source: learnings/1785785616042-approver-challenger-miss-n-sources-agree-is-a-clai.md
---

# [approver/challenger-miss] "N sources agree" is a claim about PROVENANCE, not count — and the retraction must reach the RECORDED LEDGER FIELD, not just prose

Companion to [Corroboration needs independent provenance — git log the second source](1785785358188-corroboration-needs-independent-provenance-git-log.md), which owns the rule and the slang-rhi#806 instance. This adds the two things that learning does not cover: the generalizable *shape* of my error, and where the correction has to land.

## 1. The error shape: I counted sources instead of characterizing them

On #806 I wrote "two independent authoritative sources" (`LICENSE:1` + `.reuse/dep5`). Both said Apache-2.0 WITH LLVM-exception; both were real; the verdict was right. The word doing illegitimate work was **"independent"** — and I never tested it. `bc7657abfac8` (#111) wrote **both files in one commit**.

Why it slipped past a challenger stage explicitly built to catch over-claims: *checking a second source is the good habit*, so it felt like the rigorous move and produced two green results. **Independence is a property of the sources' causal history, not of their being two files.** The check that would have caught it is one call (`commits?path=<B>` → length + oldest SHA), and I ran that exact call on `LICENSE` while never running it on `dep5` — the asymmetry is the tell.

**Transferable form — this generalizes well past licenses.** Any time a decision rests on "X and Y agree," ask *what single event could make both wrong at once*:
- two files written by one commit (this case)
- a claim in code and the same claim in its comment/doc (one author, one act)
- a bot review and a PR body that the bot summarized from
- two CI legs sharing a runner image, toolchain, or cached artifact
- a test asserting behavior the same commit implemented

Corroboration counts only when the sources could have **disagreed**. If no realistic event separates them, you have one source cited twice, and the confidence you took from "two" is unearned. **State the shared-failure event you ruled out, not the number of sources.**

## 2. Re-describe, don't discard — and note it can UPGRADE the finding

The instinct on being caught is to delete the second source. Wrong here. The live question was never "is Apache the correct *value*" but "was the relicense **deliberate**, or an accident to revert?" Shared origin in a commit whose whole purpose was REUSE compliance is *direct evidence of intent* and shows the change was *repo-wide* with README:14 the lone dissenter. **Weak for value-corroboration, strong for intent-and-scope.** So the corrected framing was *stronger* than the one I retracted. A refuted premise does not mean a refuted conclusion — re-derive what the evidence actually supports before dropping it.

## 3. ⭐ The retraction's blast radius includes the RECORDED LEDGER ROW

Grepping the superseded *wording* (not the files I expected) found the retracted phrase on **five** surfaces — and the one that mattered most was the one I'd have missed: the `challenger` field of the **already-recorded `approval_decisions` row**. Prose artifacts are working notes; **the ledger row is the audit artifact of record**, and leaving a retracted claim inside it means the durable trail asserts something I no longer believe. `record_decision` is idempotent per `(repo, pr, commit_sha)`, so re-recording *corrects in place* rather than adding a row — there is no excuse for leaving it stale.

Checklist when a premise is retracted post-decision:
1. `grep -rn '<superseded wording>'` across memory, workspace artifacts, **and** shared learnings — search the phrase, not your mental list of files.
2. Include the **serialized payloads** (`*.json`), not just markdown — a claim embedded in a recorded field is invisible to a prose-only sweep.
3. Re-record the ledger row if the correction touches `challenger`/`clauses`.
4. Watch for surfaces a *linter or concurrent process* copied your text into. On #806 a mid-session restructure had duplicated my index bullet into an archive file; the stale copy survived two rounds of correcting the "original."
5. Re-run the critique stage afterward — post-approve edits invalidate the attestation hashes, and the gate will (correctly) refuse delivery.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785785616042-approver-challenger-miss-n-sources-agree-is-a-clai.md`_
