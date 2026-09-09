---
title: PR-approver revision re-gating & review-signal judgment, plus fleet-ops false signals
type: concept
group: slang-autodiff-ir
tags: [approver, challenger, clause-gap, revision-regate, dismissed-review, open-gap, calibration, a2a-redrive, ci-hang, discord-heartbeat]
source_count: 10
---

## TL;DR

Two judgment disciplines for the auto-approver, and four fleet-ops "false signal" traps.

**Re-gating a revision — measure the defect, don't read the prose:**
- **Same-file ≠ same-region.** A new commit that touches your finding's file has not
  necessarily touched the defect. Diff the cited line range and confirm the new hunks fall
  outside the cited function (`git diff … | grep '^@@'` shows the enclosing function per hunk).
  A commit message describes intent; the ranges describe effect.
- **Relocated ≠ fixed.** A large rework that *moves* flagged code out of a file (a big negative
  diffstat, a softened bot headline) is not a fix — follow the moved symbol to its new home and
  re-read the exact predicate you flagged.

**Reading the review signal — run the mechanism, don't cite the conclusion:**
- **Green CI is necessary, not sufficient.** It closes the "does the coverage work" gap but
  resets nothing about the diff's own correctness; the challenger must still trace the NEW code's
  public-API / external-handle paths that in-repo CI never exercises.
- **A DISMISSED review can be a deliberate human withhold, not a stale-dismissal** — read
  `dismissal_message` + `dismissal_commit_id` + actor, not just `state`. They carry opposite
  decision weight.
- **A PR that advertises a broken sibling path is an OPEN_GAP, not a nit** — widening a
  diagnostic/docs message to name an operand kind whose value-path is broken makes that latent
  bug in-scope.
- **Calibration join:** a pure diagnostic-message enrichment on an already-live `default:` arm is
  a low-risk WOULD_APPROVE shape (no regression test owed).

**Fleet-ops false signals:** a2a redrive can report `bounced-unknown` for delivered messages; a
SlangPy build-pr job can hang ~2h with zero error emitted; and a Discord heartbeat's
"phantom" `new_discord_messages` count is usually real — the verification method has a blind spot.

## Re-gating discipline: measure the defect region, follow moved code

The tempting failure on a re-gate is to trust the commit message. On `slang#12455`, a second
commit pushed while a BLOCK was held on `regenerate.py:1502`; its message was honest ("trim
catalog-digest self-tests… selftest passes; lint unchanged") and touched the same file (7 ins /
40 del). Two wrong readings were available — "it touches the file, maybe it fixed it" and "the
message says only tests changed, so my finding stands" — and the second is the dangerous one
because it's usually right and free, yet it is still an unopened-artifact claim about the current
head ([same-file is not same-region](../learnings/1786390354304-approver-clause-gap-a-revision-that-touches-the-sa.md)).
What settled it in one command: diff the cited line ranges (all three defect regions byte-IDENTICAL)
and `git diff | grep '^@@'` to confirm both hunk headers landed inside `cmd_selftest` — a
*measurement* that the defect survived, not an inference from prose. **The rule: per-revision, for
every finding you carry forward, diff the cited line range and confirm the new hunks fall outside
the cited function.** Then write it re-checkably ("byte-identical at R2, verified by diffing the
ranges") rather than "unchanged per the commit message."

The sibling trap is relocation. On `slang#12466` the head advanced with a +352/−231 rework of
exactly the four files carrying a prior ABSTAIN concern; the bot review softened from "Major" to
"Minor," and `git diff --stat` showed the suspect file losing 143 lines. The easy read —
"reworked, concern addressed" — was wrong: the defect was *relocated*, not resolved.
`maybeUnpackArg`'s differential-pair branch moved verbatim into
`slang-ir-lower-dynamic-dispatch-insts.cpp:82-100`, still initializing the converted temp only
`if (as<IRBorrowInOutParamType>(paramType))` while always registering the write-back — so
`BorrowIn` reads an uninitialized differential pair and `Ref` loses its incoming value
([a revision that relocates flagged code has not necessarily fixed it](../learnings/1786643115734-approver-challenger-miss-a-revision-that-relocates.md)).
**A −143 diffstat is "code left this file," never "logic was fixed."** On a re-gate, diff the
interval, `git grep` the moved symbol at the new head, follow it, and re-read the exact predicate.
This session also carries a durable autodiff-lowering sub-lesson: green new tests passed because in
reverse mode a differentiable accessor's `this` — even a read-only `get` — is lowered as
`inout DifferentialPair` (`BorrowInOut`, the safe/initialized branch), since the cotangent must
flow into `.d`; so CI exercised the SAFE branch and did not cover the suspect one. Parameter-mode
intuitions from the surface signature do not survive autodiff lowering — check what mode the diff
transform actually assigns before ruling a branch unreachable.

## Reading review signals: run the mechanism, weigh the shape

**Green CI is necessary but not sufficient.** On `slang-rhi#831` R4, after three ABSTAIN(OPEN_GAP)
rounds driven by red lavapipe jobs, R4 turned the full matrix green and that "closed OPEN_GAP"
feeling carried toward a provisional WOULD_APPROVE — which the DECISION_REVIEW critique correctly
rejected ([green CI is necessary, NOT sufficient](../learnings/1786485852581-approver-critique-mustfix-green-ci-on-a-coverage-p.md)).
Two challenger-completeness misses: the PR gated a `VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT`
usage bit on the *enabled feature* but gated the `vkGetBufferDeviceAddress` *call* only on the
*loaded proc* — different conditions, and since slang-rhi accepts externally-supplied `VkDevice`
handles that bypass the library's own feature-enablement, the proc can be present while the
feature is off (a plausible VUID failure path that lavapipe CI is structurally blind to); and a
"pre-existing" dismissal was wrong because the `setup-lavapipe` action was newly added by the PR
and contradicted its own "pinned" contract. **The checklist before WOULD_APPROVE on backend code:**
confirm each capability/feature-gated call gates its CALL site and USAGE/CREATION site on the SAME
condition (enabled-feature vs loaded-proc vs physical-device-supported are three different things);
remember the public-API/external-handle path in-repo CI never exercises; never label a finding
"pre-existing" without confirming the lines aren't introduced by this very PR; and treat a bot's
independently-raised item as a hypothesis to verify, not to wave off. Uncertainty ⇒ ABSTAIN, never
round up.

**A DISMISSED review is not automatically stale.** On `slang#12517` a DISMISSED "LGTM" was
characterized as a branch-protection stale-dismissal, but the timeline `review_dismissed` event
showed `dismissal_message: "Need more checks"`, `dismissal_commit_id: None`, actor = the reviewer
themselves — a *deliberate human withhold*, the opposite of a passive stale-dismissal
([read dismissal_message + dismissal_commit_id, not just state](../learnings/1787295658465-approver-clause-gap-dismissed-review-read-dismissa.md)).
The self-correction is sharp: the author's own memory carried the exact rule ("DISMISSED ≠
RETRACTED — read the two fields") yet applied the rule's *conclusion-shape* ("dismissed, so
probably stale") without running its *mechanism* — **citing a rule is not running it.** The
discriminator: `dismissal_commit_id` present + no human message + branch-protection actor ⇒
stale-dismissal (neutral weight); `dismissal_commit_id == None` + a human message + maintainer
actor ⇒ manual withhold (a strong pull toward ABSTAIN absent a later favorable signal). It didn't
flip the verdict here only because the withheld concern was later satisfied and the reviewer
affirmed the fix inline — so also harvest a reviewer's *later* inline comments, not just their
review states.

**Advertising a broken sibling path is an OPEN_GAP.** `slang#12583` ("Support countof for enum
types") adds `countof(EnumType)` correctly and *also* widens the E30083 diagnostic from
"type pack or tuple" to "…, **array**, or enum type" — but `countof(arrayType)` materialized as a
value lowers to `size.alignment`, not element count (a pre-existing, silently-wrong path). Nothing
the diff *introduces* is defective (so not a clean BLOCK), yet widening a user-facing message to
*advertise* a kind whose value-path is broken turns a latent bug into a reachable false-advertising
trap ⇒ ABSTAIN_POLICY:OPEN_GAP, a genuine maintainer scope call
([widened diagnostic advertising a broken operand-kind is an OPEN_GAP](../learnings/1787769461370-approver-clause-gap-widened-diagnostic-message-adv.md)).
The transferable probe: when a PR widens a diagnostic/acceptance message (or docs) to advertise a
new operand/case/mode, verify EVERY newly-advertised kind on ALL evaluation paths — especially when
the author edited the exact function containing the buggy line ("I was right next to it and chose
not to fix it" is a maintainer decision, not something the approver clears silently). Don't round
"own code fine but advertises a broken sibling" up to WOULD_APPROVE, and don't force it to BLOCK.

**The confirmed low-risk shape (calibration join).** For contrast so this isn't "always abstain":
`slang-rhi#842`, a +6/−2 change that only enriches an existing release assert's message
(`SLANG_RHI_ASSERT_FAILURE("Unsupported binding type")` → `… + std::to_string((int)bindingType)`,
plus `#include <string>`, a scoping brace, and a dead `break;` removal), was WOULD_APPROVE and the
human approved at the exact decided head — agreement
([diagnostic-only assert-message change, WOULD_APPROVE held](../learnings/1787059078625-approver-human-agreement-diagnostic-only-assert-me.md)).
The transferable signal: it changes an assert's message string, not control flow or behavior; the
touched branch is a `default:` arm reachable only on unsupported input (the crash being diagnosed),
so **no regression test is owed** — don't flag its absence as OPEN_GAP. The only things worth
verifying (and they held): the local `std::string`'s lifetime is fine when the assert macro
consumes `.c_str()` synchronously, and the new local doesn't cross a later `case` label's
initialization. Contrast with shapes that did *not* clear: widening the input set reaching an
unchanged-but-buggy path (expands latent-defect reachability), or a new diagnostic gated behind a
new flag (can silently always-skip). #842 is a pure message enrichment on an already-live path and
does neither.

## Fleet-ops false signals

**a2a redrive can report `bounced-unknown` for messages that were actually delivered.** On thread
`gh-issue-shader-slang/slang-12662`, the redrive subsystem reported `bounced-unknown` (2×) for two
messages to `slang-reviewer` that both delivered — the recipient replied twice acknowledging
receipt ([a2a redrive can emit false bounced-unknown](../learnings/1787311045570-a2a-redrive-can-emit-false-bounced-unknown-for-del.md)).
A spurious bounce can trick the sender into re-driving a third time and duplicating the payload
to a recipient already mid-work. **Before re-driving on a reported `bounced-unknown`, check
whether the recipient already replied** — a reply is proof of delivery and the bounce is then
false. Detector for a real duplicate slipping through: two running sessions in the recipient's
agent group for one task/thread (`ncl sessions list`). (Reported by the fixer, not independently
verified by Main.)

**A SlangPy build-pr job can hang ~2h with zero error emitted.** On `slang#12734`, the cross-repo
`SlangPy Tests` job's `build-and-test-with-slang` step started and simply never completed — no
error, no exception, no `FAILED` line, no `timeout-minutes` message in the full 2.1MB log; GitHub
force-completed it as `failure` ~2h8m later
([SlangPy build-pr job can hang ~2h with zero error](../learnings/1787724952030-slangpy-build-pr-job-can-hang-2h-with-zero-error-e.md)).
Classify this as a runner-side wedge/hang (the falcor-build-approval-gate wedge class), not a code
regression — don't grep the log for a root cause that isn't there; check the job-level
`started_at`/`completed_at` gap vs the last log timestamp (here a ~1h38m silent gap after all
visible output stopped). The bot CAN rerun cross-repo slangpy jobs
(`gh run rerun <run-id> --repo shader-slang/slangpy --failed`); verify the `run_attempt` counter
incremented, not just rc=0.

**A Discord heartbeat's "phantom" `new_discord_messages` count is real — the check has a blind
spot.** A recurring "unexplained" gap (precheck reports N>0 but a re-read of the three "primary"
channels shows 0 new) was carried as an open mystery. Reading the *actual* scheduled-task script
(`ncl tasks get …`, not the CLAUDE.md's flagged-stale copy) showed the precheck polls
`#slang-discussion` **and `#slang-dev`** plus forum/support threads — and every prior "re-read to
explain the count" only checked the three channels the doc calls primary, never `#slang-dev`
([the phantom count was #slang-dev](../learnings/1788393228873-slang-heartbeat-phantom-new-discord-messages-count.md)).
A doc's primary/secondary channel *classification* (where the bot answers support questions) is not
a complete list of what the *monitoring script reads* — different concerns the doc conflates.
**When a precheck value can't be reproduced, read the actual script for the literal IDs it polls
and check ALL of them.** A follow-up correction refines this: forum *parent*-channel reads return
0 messages even when an active thread has fresh replies (`discord_read_messages` on the
#slang-support parent ID returns `{"messages": [], "total_count": 0}` — forum parents have no
top-level messages, all content lives in threads)
([forum parent reads return 0; check the specific thread ID](../learnings/1788404541359-discord-forum-parent-channel-reads-return-0-messag.md)).
So when the count still doesn't reconcile, also read the most recent summon thread IDs directly
(from `summon_requests.jsonl`); a follow-up reply inside an already-summoned thread is invisible to
a parent-channel read but shows up instantly on a thread-ID read — and such follow-ups are not new
summons (handled by the per-thread wiring, no heartbeat action needed), just don't mistake them for
an unexplained gap.

**Source learnings (10):**

- [A revision that touches the same file is not one that touches the defect — diff the line ranges](../learnings/1786390354304-approver-clause-gap-a-revision-that-touches-the-sa.md) — Diff the cited range + `grep '^@@'` for the enclosing function; a measurement the reader can re-check, not an inference from the commit message.
- [Green CI on a coverage PR is necessary, NOT sufficient — the challenger must trace the NEW code's public-API paths](../learnings/1786485852581-approver-critique-mustfix-green-ci-on-a-coverage-p.md) — Enabled-feature vs loaded-proc vs physical-device gates differ; external-handle paths CI can't exercise; "pre-existing" must be verified against the diff.
- [A revision that RELOCATES flagged code has not necessarily FIXED it — re-trace the moved logic](../learnings/1786643115734-approver-challenger-miss-a-revision-that-relocates.md) — A −143 diffstat is "code left this file," not "logic fixed"; plus reverse-mode lowers a read-only `get`'s `this` as `inout DifferentialPair`, so green CI hits the safe branch.
- [Diagnostic-only assert-message change — WOULD_APPROVE held (calibration join, agreement)](../learnings/1787059078625-approver-human-agreement-diagnostic-only-assert-me.md) — Message-string enrichment on an unreachable `default:` arm owes no regression test; contrasted with reachability-widening and new-flag shapes that didn't clear.
- [DISMISSED review: read dismissal_message + dismissal_commit_id, not just state](../learnings/1787295658465-approver-clause-gap-dismissed-review-read-dismissa.md) — Manual "Need more checks" withhold vs branch-protection stale-dismissal carry opposite weight; citing the rule ≠ running its mechanism; harvest later inline comments too.
- [Widened diagnostic message advertising an operand-kind the PR leaves broken is an OPEN_GAP, not a nit](../learnings/1787769461370-approver-clause-gap-widened-diagnostic-message-adv.md) — Advertising a kind whose value-path is broken makes the latent bug in-scope; verify every newly-advertised kind on all paths; route to ABSTAIN_POLICY:OPEN_GAP.
- [a2a redrive can emit false bounced-unknown for delivered messages](../learnings/1787311045570-a2a-redrive-can-emit-false-bounced-unknown-for-del.md) — A reply is proof of delivery; check for it before re-driving on a bounce; two running recipient sessions for one thread flag a real duplicate.
- [SlangPy build-pr job can hang ~2h with zero error emitted](../learnings/1787724952030-slangpy-build-pr-job-can-hang-2h-with-zero-error-e.md) — Runner-wedge class, not a regression; check the started_at/completed_at gap vs last log line; bot can `gh run rerun --failed`, verify the attempt increment.
- [Slang heartbeat "phantom" new_discord_messages count was never phantom — it's #slang-dev](../learnings/1788393228873-slang-heartbeat-phantom-new-discord-messages-count.md) — Read the actual task script for the literal channel IDs it polls; a doc's primary/secondary classification isn't the monitor's read list.
- [Discord forum parent channel reads return 0 messages — check the specific thread ID](../learnings/1788404541359-discord-forum-parent-channel-reads-return-0-messag.md) — Forum parents have no top-level messages; read the summon thread ID directly for follow-ups; in-thread follow-ups aren't new summons.
