---
name: feedback_a_correct_action_does_not_validate_its_rationale
description: "State decides WHETHER to act; premise decides WHAT to say. A correct action — or a correct CONCLUSION — ships a false rationale unchallenged, because nothing fails either way. Four axes: rationale, attribution/authorship, and a gloss I SUPPLIED riding a peer's measured finding into publication."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 95b5ce21-3019-4f32-88de-5f7e43daa117
---

# A correct action does not validate the reasoning that arrived with it

**2026-08-04, slang-pr-approver on slang#12322; the generalization is joint.**

## The incident
An auto-router dispatched a re-review with a stated rationale that was ~90% an accurate description
of the work — and **wrong on a hard invariant**: it called a shadow-mode `WOULD_APPROVE` verdict
*"ready for approval and merge."* It is neither. `WOULD_APPROVE` is a **prediction** of what a
maintainer would decide, recorded so the call can be scored against the human outcome; no approve
credential exists in that container and none is ever simulated. MINE-VERIFIED at the time: #12322 had
**9 reviews, all `COMMENTED`, zero approvals**, `reviewDecision: REVIEW_REQUIRED`.

The approver's state pre-flight correctly produced a **no-op** (head unmoved at an already-decided
SHA ⇒ re-deciding would duplicate a ledger row). **But the no-op is identical whether the rationale is
sound or false** — so absent a separate check, the false premise ships behind a correct action.

## ⭐⭐⭐ The two rules
1. **STATE decides whether to act; PREMISE decides what to say.** Two separable checks. Verifying the
   state does not verify the framing that arrived with the task, and **a correct outcome is not
   evidence about the reasoning** — this is the case with *no natural trigger*, because nothing fails.
2. **Anything arriving as CONTEXT rather than as a CLAIM gets read past — the format suppresses the
   scrutiny.** A peer's assertion invites challenge; framing attached to the work carries the
   appearance of system authority and is absorbed. Same family as *"presence of a lesson is not
   presence of an open task"* (a retrospective read as a directive) and a stale routing memo read as
   current state.

✅**Practical form (approver's, adopted): grep any rationale for verbs implying authority the actor
does not hold** — `approve` / `merge` / `post` / `close` / `land`. Cheap, and it fires exactly on the
class where a bot appears to have done something it cannot do.

## Why this matters for MY tier specifically
A conflation like *"the bot's verdict is ready for merge"* passing into a report would read as though a
bot had approved a PR — a credibility failure with a long tail, and one my own verification would not
catch, because I verify **state** (head, review states, merge status) and the defect is in **framing**.
⇒ When relaying any coworker's decision, restate the *epistemic status* explicitly (prediction vs.
approval, verified vs. attested, mine vs. theirs) rather than inheriting the dispatch's wording.

## ⭐⭐ Corollary: an AVERTED error has no error signal of its own
The same chain declined to apply its own 4-step probe because the input was misclassified as
"new flag + new gate" when the gate and flag both pre-existed — **applying a correct procedure to a
misclassified input yields a false abstain, and an abstain looks like caution regardless of whether it
was warranted.** So the approver filed *join-time calibration items*: if #12322 merges unchanged at
`ba156ebf5c90`, that confirms the monotone classification held and the declined probe was correctly
declined.
⇒ ⭐⭐**Deliberately record the checks you DIDN'T run and what outcome would vindicate them.** A
near-miss you avoided produces no failure, no ticket, and no memory — so it teaches nothing unless you
write down what would have proved you right. Same shape as *"a negative datapoint is easy to skip
precisely because nothing failed."*

Related: [[feedback_a_phantom_correction_deletes_true_evidence]] (errors cluster in corrections),
[[feedback_near_miss_number_is_a_boundary_not_noise]] ("nothing owed" is the moment to check),
[[feedback_control_the_instrument_not_the_reasoning]].

## ⛔⭐⭐⭐ THE ATTRIBUTION VARIANT — I sent endorsements to the wrong session (MY error, 08-04 #12150)
Same two-checks structure, third axis. I verified a report's **claims** and never its **author**.

**What happened:** a `[Fix Report]` on slang#12340 reached my inbox. I verified everything checkable —
draft status, 23 files/+691−13, the label, and the reviewer timeline showing `jhelferty-nv` (a human,
not CODEOWNERS) assigning `jkwak-work` + `tangent-vector`. **All true.** I then addressed two messages
of detailed endorsement to whichever session's message had arrived — the wrong one. The actual author
was `sess-…ovhk89`; the arm I replied to had stood down at 11:12.

**The stood-down arm caught it and declined the credit**, with instruments worth stealing:
- artifact `createdAt` vs. **its own last action** (#12339 @13:22:10Z, #12340 @13:36:46Z — both after
  its 13:13 restart);
- ⛔**`git reflog` and "does the branch exist on my remote?" — I labelled the latter DECISIVE and it is
  NON-DIAGNOSTIC.** Corrected by the fixer: `git log origin/<branch>` failing proves only that the local
  *tracking ref* is absent; `git ls-remote origin refs/heads/fix/issue-12150` in fact returns
  `80da876add` — the branch IS on origin. **And even corrected, it cannot answer the question: sibling
  sessions are separate containers sharing ONE `/workspace/agent/` volume, so `ls-remote` matching a HEAD
  proves the CLONE pushed, never the SESSION.** ⇒ ⭐⭐⭐**GIT CANNOT ANSWER SESSION AUTHORSHIP AT ALL.**
  `ls-remote` = the clone pushed; `reflog` = when HEAD moved, never by whom. Both are **timing inputs to
  cross-reference**, not authorship evidence. ⚠️**I shipped this as a recipe labelled "decisive" — a false
  instrument in a lesson about verifying provenance, which is worse than the original error because a
  recipe propagates.**
- ✅**THE ACTUALLY DECISIVE INSTRUMENT: the session's OWN transcript.** Row timestamps in
  `<session-id>.jsonl` — one assistant turn at 13:15:04, then **zero rows until 13:46:59**, with #12339
  created 13:22:10Z and #12340 at 13:36:46Z both inside that 31-minute gap. **A zero-row gap spanning the
  artifact's `createdAt` converts "I don't recall acting" into a CHECKABLE ABSENCE OF ACTION** — which is
  the standard a decline requires, and the one neither of us met at first.
- I confirmed with `ncl sessions list`: `…ovhk89` `running`, `last_active 13:46` — live through the
  whole window.

⇒ ⭐⭐⭐**Confirming that a report's claims are TRUE tells you nothing about WHO MADE THEM.** Accuracy
and provenance are separate checks; I ran the one that passed. **Credit can be misattributed rather
than wrong** — a distinct failure from a false claim, and invisible to any check aimed at correctness.
⇒ ⭐⭐⭐**SHARED LINEAGE MAKES RECOGNITION NON-DIAGNOSTIC.** The stood-down arm *recognized* the
entry-point-coincidence trap because it **is** its own — it sits in its plan file. That genuine partial
authorship is exactly what made *"this sounds like me"* feel like evidence when it was worthless.
**A misattribution built on shared upstream analysis will always feel familiar.**
⇒ ⭐⭐**Praise is the polarity nobody warns you about.** The approver's exculpatory error (*"someone
else left a mess"*) and this one (*"these are findings I'd be pleased to have made"*) sit on the same
axis: **comfort in either direction suppresses the check**, and credit arrives with no adversary.
⇒ ✅**My fix: when relaying or endorsing a coworker's work, verify the AUTHOR the same way I verify the
state** — `ncl sessions list` for who was live in the artifact's creation window, and address the
canonical thread rather than the inbox message that happened to arrive.

⚠️**Not a collision, and the fixer was right to insist on the distinction:** nothing of its was at
risk, nothing needed standing down — **the defect was routing.** Filing it as a second collision would
blur two failures with different remedies (same reason a `ps`-count delta is not a collision signature).

Also worth noting **how it recorded this**: folded into an existing rule rather than a fifth
near-duplicate file. ⭐**A sub-mechanism belongs inside the rule it refines; a new file fragments the
retrieval path** — which is the same reason a lesson must be keyed to the question that summons it.

## ⛔⭐⭐⭐ THE SUPPLIED-GLOSS VARIANT — my inferred rationale rode a peer's MEASURED finding into publication (MY error, 08-06 slang#12384)

Fourth axis, and the one where I am the *source* rather than the reader. `slang-triager` measured a
genuine finding on #12384 (reflecting `Empty` as size 1/align 1 would break the no-`public` shape that
agrees today — verified in an isolated worktree, both columns through one script). **I handed it a
supporting gloss**: *"size-1/align-1 is the host-C++ answer, so it belongs in the CUDA target's layout
rules rather than in shared reflection."* Inferred, never checked. It published inside the verdict
(cmt `5201509099`) **in the same bullet that cited PR #8257 as the rejected precedent** — and #8257's
own body names `CUDALayoutRulesImpl::EndStructLayout`, its diff hunk landing in
`struct CUDALayoutRulesImpl : DefaultLayoutRulesImpl`. **#8257 was already target-scoped and was
rejected anyway**, on the stronger ground *"empty structs should be reported as 0 bytes in slang
layout… the issue is more in why empty structs still exist after empty type legalization"* — i.e.
**layout is the wrong layer, full stop**, not "wrong layer within layout." My gloss argued for the
placement the rejected PR had used, citing that PR two clauses earlier.

⇒ ⭐⭐⭐**A rationale I supply rides the recipient's credibility while carrying none of its
verification.** The triager's finding was measured; my sentence was inferred; both went out under one
byline at one confidence level. The recipient cannot distinguish them — **provenance does not survive
the handoff** unless I mark it.
⇒ ⭐⭐⭐**A WRONG MECHANISM UNDER A RIGHT CONCLUSION DRAWS NO PUSHBACK FROM OUTCOMES.** The conclusion
my gloss supported ("don't fix this in reflection") is correct, so nothing downstream could ever have
flagged the reasoning. This is the same no-natural-trigger structure as rule 1 above, one level deeper:
not just *a correct action* but *a correct conclusion* laundering a false premise.
✅**The check, and it is cheap: which artifact does my sentence make a claim about, and did I open
THAT one?** Both of us failed exactly this — the triager had read #8257's *closing comment* and wrote
about #8257's *contents*; I wrote about where a fix belongs without reading the PR that put it there.
One fetch. ⇒ **Before handing a peer a framing to attach to their finding, verify it to the standard
their finding meets — or label it explicitly as unverified inference so it cannot inherit their
confidence.**

⚠️**Remedy shape:** post the retraction **fresh, never as an edit** to the original comment. GitHub
fires notifications on creation and never on edit, so an in-place fix is *stored* but *undelivered* on
a chain the reporter is actively working (shared learning
`1785976804406-edit-if-last-poster-is-self-is-unsafe-under-a-shar`, §Delivery — this is a
shared-only lesson, no local leaf). Leaving `5201509099` untouched
(`created==updated`) also keeps the record showing the claim *and* its retraction rather than a
silently rewritten history.
⚠️**Instrument note (triager's, worth keeping):** **a diff hunk header is the authority for where a
patch landed; current line numbers are not.** #8257's hunk reads `@@ -634,6 +634,13 @@` while
`CUDALayoutRulesImpl` sits at `:755` at HEAD — checking `:634` against today's file would read as a
mismatch and make a *correct* correction look wrong.
