---
name: 12375-downstream-sibling-sweep-followup
description: "slang#12375 — the SANCTIONED follow-up sweep to #12353 (8 carriers of the defective link default). Draft, APPROVE_WITH_NITS, base=fix/issue-12342. Split out of the #12342 memo 2026-08-06 when that memo passed the read bound."
type: project
---

**Child of [[project_12342_downstream_absent_capability_slangresult]]** — read that first for the #12353 chain, the drafts-only/no-rebase constraints, and the scope provenance split. **Split out because the parent memo reached 44,346 B against a ~24.4 KB read bound, making everything below dark on load** — i.e. every finding on this page was unreachable while it lived there.

**PR #12375** (draft) — sanctioned by jkwak-work: *"Please make another PR for the follow up that makes the unavailability return."* Head `de705e926d`, `base=fix/issue-12342` (stacked on #12353), 7 files, `APPROVE_WITH_NITS` / 0 bugs. **Owned by a DIFFERENT session than the one that reported it to me** — see the ownership section below.

## ⛔ MY OWN FALSE MEMORY, and the guard that was real after all (2026-08-06 00:19Z, post-restart)

**A peer cited cron row `pr12353-merge-guard-f006` and said it read the row. My instinct was "I never called `schedule_task`" — I was WRONG.** `ncl tasks list` shows it: `*/20 * * * *`, `script: bash /workspace/agent/pr12353-guard.sh`, created 00:15, `RUNS 0`, next run due. **I armed it in context the container restart then took from me, and my memory of "never scheduled" was confabulated.** ⇒ ⭐⭐⭐ **After a restart, absence of a memory is NOT evidence of absence of the action — query the durable system before contradicting a peer who cites it.** I nearly published a correction that would have been flatly false, against a peer who had actually done the verification I was about to demand.

⛔⛔ **AND THE GUARD'S PROMPT CARRIED A WRONG FIGURE DESTINED FOR A PUBLIC PR BODY: "7 carriers" of the defective `link` default. It is EIGHT.** The arithmetic said "9 implementors" when the tree has **TEN** derived classes. Verified (`grep 'class [A-Za-z]*DownstreamCompiler *:' source/`, excluding `IDownstreamCompiler` and `DownstreamCompilerSet`): CommandLine, DXC, FXC, GCC, Glslang, LLVM, Metal, NVRTC, Tint, VisualStudio = **10** − 1 abstract conduit (`CommandLineDownstreamCompiler`, 3 pure virtuals at `slang-downstream-compiler.h:470/:472/:475`) − 1 override (Glslang) = **8 CARRIERS: DXC, FXC, GCC, LLVM, Metal, NVRTC, Tint, VisualStudio** (GCC + VisualStudio two-level via CommandLine, both carriers). **Corrected at source in the cron prompt (verified: "EIGHT carriers" present, "7 carriers" gone).** ✅ Confirmed PR #12375's body carries **no** carrier count, so nothing wrong went public. ⇒ ⭐⭐ **A figure staged for verbatim publication must be verified at the moment it is STAGED, not when it is published — the staging step feels like note-taking and gets no scrutiny.**

✅ **Sharpest form of the enumeration hazard, verified: glslang's `link` is declared `int` at `slang-glslang-compiler.cpp:57` and defined `SlangResult` at `:413` — same method, two spellings, two files.** Either single-spelling search returns a plausible incomplete answer. Also verified: **zero `include/` references to `IDownstreamCompiler`** ⇒ internal header, public-ABI rules do not apply, interface-default fix is the cheap one.

## ⚠️ PR #12375 (the sanctioned follow-up) — BASE MISMATCH, fixer's call

Draft PR **#12375** open, head `de705e926d`. Fixer reported *"7 files, +508/−16, stacked on #12353's approved head"*. **Measured: `base=master@49584a0890`, 10 files, +936/−21** — and the diff **includes #12353's own changes** (`slang-emit.cpp +17-2`, `slang-diagnostics.lua +7-0`, `unit-test-spirv-validation-unavailable.cpp +412-0`). ⇒ **The stacking intent is right but the `base` field is `master`, so the parent commits do NOT drop out and jkwak-work would see his already-approved `validate` change presented for review a second time** — the re-litigation the stacking was meant to avoid. Offered two options (retarget base via `gh pr edit --base`, no force-push, auto-retargets on merge; or make the overlap explicit in the body), leaning retarget, **left as the fixer's call** since it touches an open PR. **No force-push of `de705e926d`.**

## ⛔ FIFTH WRONG-TREE MEASUREMENT — and it nearly refuted a CORRECT peer citation

**Peer cited `slang-glslang-compiler.cpp:518` as a `return SLANG_FAIL` inside `getVersionString` (defn `:497`) on PR #12375's head.** On MY clone that line is success-path code and `getVersionString` sits at **`:493`** ⇒ I had it as a bad citation and was composing the correction. **My clone is `master` (`49584a089`); their head is `de705e926d`.** Fetched the head via `gh api contents/...?ref=de705e926d`: **`497: SlangResult GlslangDownstreamCompiler::getVersionString` · `518: return SLANG_FAIL`** — **exactly right**, offset +4 by the lines the PR adds above. ⇒ ⭐⭐⭐ **A +4 line offset is the most dangerous size of tree mismatch: large enough to land on different code, small enough that the cited line still LOOKS plausible, so the mismatch reads as a peer error rather than a corpus error.** Fifth instance on this chain (wrong file · wrong branch · wrong query · wrong tree · wrong tree again). **When citing a line against a peer's branch, state which tree — and assume `master` unless told otherwise.**

⭐⭐⭐ **THREE INDEPENDENT DERIVATIONS OF ONE 8-MEMBER SET PRODUCED 6, 7, AND 7 — TWO DIFFERENT WRONG SETS WITH THE SAME TOTAL.** Reviewer's 7 excluded a real carrier and included the abstract conduit; fixer's 7 dropped `DXCDownstreamCompiler` while tallying (having already established it doesn't override `link`); my first pass said 6. **A matching total between agents is NOT corroboration — reconcile MEMBERSHIP, not the count.** This is the set-level form of *verified fragments do not verify the conclusion*.

## ⚠️ #12375 OWNERSHIP — a bot-identity collision, and the transcript is the discriminator

**PR #12375 was NOT created by the session that reported it to me.** Author is `app/nv-slang-bot` (shared identity); the creating session first wrote at 22:55:57 and posted the pr-link at 00:18:30, while the session I replied to first wrote at 00:24:43 — **after** my message. ⇒ ⭐⭐ **Under a shared bot identity, "your PR" is a premise to verify, not accept — and the discriminator is the TRANSCRIPT, not the identity.** The peer refused to edit another session's in-flight PR, which was correct. **Routed the base decision to the owning session via `target_session_id=sess-1785857653415-k3trwz` on thread `gh-issue-shader-slang/slang-12342`.**

⛔ **My session-lookup grep returned EMPTY twice and I nearly concluded the session did not exist** — the peer's `e9461cf9` is a **transcript UUID**, while `ncl` ids are `sess-<epoch>-<suffix>`. **Two ID namespaces for one concept; a grep in the wrong namespace returns a true, meaningless zero.** Caught by a firing control (2306 rows total) before drawing any conclusion.

✅ **Peer's Gap 1 must-fix on #12375 VERIFIED and it is correct:** the PR claims the `slang-ir.cpp` branch cannot be unit-tested because `IRModule::create` is not exported from `libslang.so`. **Premise true, conclusion false** — `tools/CMakeLists.txt:414-425` already solves exactly this, recompiling `slang-repro-validator.cpp` into `slang-unit-test` with a comment naming the reason (*"free function in namespace Slang with no SLANG_API export annotation… not visible from outside the DLL"*). ⇒ **honest form is a COST argument (large IR translation unit vs. small validator), not an IMPOSSIBILITY one.** Wording only, no code change.

## ✅ #12375 RESOLVED (00:28-00:30Z) — and both peer reports about it were STALE ON ARRIVAL

**Measured 00:31:10Z: `base=fix/issue-12342`, `files=7`, `updated=00:30:01Z`; timeline `base_ref_changed by nv-slang-bot[bot] at 00:28:39Z`. #12353's three files CONFIRMED ABSENT (grep count 0 each).** Gap 1 must-fix also live (*"a cost judgement, not an impossibility"* + `tools/CMakeLists.txt:414-425` cited by range). ⇒ **BOTH routing items closed before either peer asked me to route them** — the retarget predates the fixer's 00:30 "still open and still not mine" and the reviewer's 00:29 forwarding request.

⇒ ⭐⭐⭐ **WHEN A PEER ASKS YOU TO RELAY SOMETHING, CHECK WHETHER THE THING IS STILL UNDONE BEFORE RELAYING.** A stranded-message / still-open report is a **claim about state** and decays exactly like a CI reading. Two independent, sincere, correct-when-written reports were both stale on arrival; acting on them would have cost two sessions' turns re-delivering settled work and risked a duplicate edit. **Verify the artifact, not the hand-off.**

⚠️ **The GitHub timeline cannot attribute the retarget: `base_ref_changed by nv-slang-bot[bot]` — the shared identity again.** I can confirm *that* it happened and *when*; not *which session*. Consistent with the routed session acting; asserted no further. **Identity is not attribution at the GitHub layer either.**

⛔ **I GAVE CREDIT THAT WASN'T EARNED AND THE RECIPIENT DECLINED IT WITH TRANSCRIPT EVIDENCE.** I praised the fixer for the #12375 body edit because their relay of it arrived in this thread — **the identical premise error as "your PR" 40 minutes earlier: a report arriving on an edge read as authorship.** Their four tool_use rows touching #12375 are all read-only, zero `gh pr edit`; the artifact is `e9461cf9`'s. ⇒ ⭐⭐⭐ **Under a shared identity, BLAME AND CREDIT ARE BOTH PREMISES TO VERIFY, and the discriminator is the transcript.** Twice each, opposite directions, one night. ⭐ **Their catch depended on my framing being specific enough to check** ("you cited the precedent against yourself") — *a vaguer compliment would have passed unchallenged*, which is an argument for making praise as falsifiable as criticism.

⭐⭐⭐ **THE CARRIER-SET DATASET — three derivations, three distinct failure modes, two agreeing on a wrong number from DIFFERENT sets:**

| derivation | total | defect |
|---|---|---|
| fixer, first | 6 | dropped GCC + VisualStudio — one-level enumeration |
| reviewer | 7 | **right set, glslang subtracted TWICE** — bad arithmetic on a correct list |
| fixer, second | 7 | dropped DXC — a class it had ALREADY verified as non-overriding |
| **truth** | **8** | DXC, FXC, GCC, LLVM, Metal, NVRTC, Tint, VisualStudio |

⇒ **Each defect is invisible to the check that catches the others: a set audit misses bad arithmetic, a total audit misses a wrong member, a method audit misses a transcription drop.** The 7–7 agreement was the most persuasive-looking evidence produced on the question and was worth **nothing**. **Practice: derive into a WRITTEN LIST, count the list mechanically, publish both — and compare MEMBERS with a peer, never totals.** ⭐ **One notch further (mine): publish the EXCLUSIONS WITH REASONS**, because both wrong 7s were *exclusion* errors — an inclusion list makes membership auditable; only an exclusion list with reasons makes the OPERATION auditable.

⛔ **AND THE SET HAS HETEROGENEOUS MEMBERSHIP REASONS, which a membership audit alone would pass.** The fixer's change summary said LLVM's three "override the base class, so the base-default change cannot reach them" — **wrong mechanism**: `slang-llvm.cpp:116` doesn't derive from `DownstreamCompilerBase` at all. Same conclusion, wrong reason. ⇒ **LLVM is a carrier for a DIFFERENT reason than the other seven** (they inherit the default; it bypasses the base entirely). ⇒ ⭐⭐ **A membership audit that asks "is X in?" without asking "WHY is X in?" passes a uniform-mechanism claim that is false** — the reachability-vs-ownership distinction reappearing *inside* the set built to settle it.

## ✅ #12375 wrong-mechanism sentence — FIXED before I could route it (00:32:51Z)

**Peer reported the sentence *"These override the base class, so the base-default change cannot reach them"* as verified-open in #12375's body :67 and asked me to route it.** Measured 00:32:51Z: body :67 now reads *"This class implements `IDownstreamCompiler` directly (`:116`) rather than deriving from `DownstreamCompilerBase`, so the base-default change cannot reach it — it needs its own edit."* ✅ **Correct mechanism, `grep "override the base class"` → 0 hits.** Nothing routed.

⇒ ⭐⭐⭐ **THE PEER EXPLICITLY RE-CHECKED BEFORE ASSERTING IT WAS OPEN, AND IT WAS STILL STALE WHEN IT REACHED ME.** Third state-claim decay of the night and the sharpest: they applied the verify-before-relaying rule *correctly* and the artifact moved in the gap between their check and my read. **"Verified open" carries a timestamp too, not just "verified."** ⇒ **The remedy is NOT more checking — it is that the party who can ACT should be the party who CHECKS.** Here that was always the owning session; every relay hop adds a decay window that no amount of diligence at the relay closes.

⛔ **THIRD MISATTRIBUTION FROM ME, ONE GENERATOR: I read a peer's RELAY of someone else's text and attributed the text to the RELAYER.** I wrote "your change summary" about text in `e9461cf9`'s PR body; the fixer's own artifact said the correct thing all along (0 hits for the wrong phrasing). Same shape as crediting them for the body edit, and as addressing "your PR" to them. ⇒ ⭐⭐ **A RELAY IS NOT A CLAIM OF AUTHORSHIP. When a peer quotes an artifact, the provenance is the ARTIFACT'S, not the quoter's, unless stated.** They have now corrected me in both directions — blame (sibling-isolation overclaim) and credit (body edit) — each time from their transcript.

⭐⭐ **A WRONG REASON ATTACHED TO A RIGHT CONCLUSION IS MORE CORROSIVE THAN A WRONG CONCLUSION** — it is the reasoning a reviewer is being asked to trust. A reviewer checking `slang-llvm.cpp:116` would find the stated reason false while the conclusion held, and discount the surrounding argument. The corrected form is also *categorically* stronger: "doesn't derive from it at all" cannot lapse; "overrides it" is contingent on the override staying.

⭐⭐⭐ **THE THROUGH-LINE OF THE FINAL STRETCH (peer's framing, adopted): each finding was a defect in the REMEDY for the previous defect.** "Compare members, not totals" → couldn't catch either wrong count, because both were *exclusion* errors. "Publish the member list" → passes a false uniform-mechanism claim, because membership is heterogeneous. A guard written to close an observability gap → silently inert, then finite-timeout. ⇒ **Treat a freshly-agreed fix as the NEXT thing to audit, not as the resolution.**

## ⛔ INSTRUMENT LIMIT, verified: NO GitHub surface attributes an API action to a session

**Peer flagged that the GitHub timeline reports the App, not the session. Confirmed, and my control tightens it — BOTH candidate discriminators fail:**
```
timeline base_ref_changed  →  actor="nv-slang-bot[bot]"  actor_type="Bot"   (node_id is opaque)
commit de705e926d          →  author=nv-slang-bot <nv-slang-bot@users.noreply.github.com>
```
⇒ **The author-email discriminator that resolved #12353's commit authorship does NOT apply to API actions, and the commit email here is the same generic bot address** — so neither the timeline nor the commit metadata can answer *"which of our sessions performed this."* ⭐⭐⭐ **The most authoritative-looking instrument for the question is the one that structurally cannot answer it** — and that shape produced **four** mis-bindings between us tonight ("your PR", the body-edit credit, the wrong-mechanism sentence, and a stranded-verdict routing). **The transcript is the ONLY discriminator; treat every GitHub actor field as identity, never as attribution.**

⭐⭐⭐ **VERIFICATION BELONGS AT THE POINT OF ACTION, NOT THE POINT OF OBSERVATION** (peer's formulation, adopted). Measured shelf lives on this chain: the base-retarget claim decayed in **81 seconds**; the body-`:67` claim in minutes *after an explicit re-check*. ⇒ **On a live PR with an active owner, a state claim's shelf life is shorter than the round-trip to report it.** That is not a reason to stop reporting — the reporter *structurally cannot* close the window. It is a reason the RECIPIENT must re-check before acting.

✅ **And the invariant across two PRs and four agents: the compiler analysis never moved.** `SLANG_E_NOT_AVAILABLE` as the distinct code for an absent capability was right in #12353's first commit and right in #12375's. **Every defect landed in measurement, relay, tooling, or scoping** — the domain work had review structure around it; the measurements had none, because each looked like a fact rather than a claim.

## ⛔⛔ MERGED BUT NOT SHIPPED — #12375 landed in its BASE BRANCH, not master (2026-08-06 04:44:35Z)

**`jkwak-work` merged #12375 as squash `ba224921a1` into `fix/issue-12342`** — the base was never retargeted to `master`, so the merge went where the PR pointed. **`master` tip is still `9cd92bb3a1` (#12353 only).**

✅ **Verified with a FIRING CONTROL (mine), not inferred from the base field:**
```
contents/tools/slang-unit-test/unit-test-downstream-not-available.cpp?ref=master   → 404 Not Found   (the sweep)
contents/tools/slang-unit-test/unit-test-spirv-validation-unavailable.cpp?ref=master → PRESENT        (#12353, control)
```
**The control proves the probe works ⇒ the 404 is a real absence.** Peer independently confirmed three ways: `merge-base --is-ancestor ba224921a1 origin/master` → NO; `grep -c SLANG_E_NOT_AVAILABLE` in master's `slang-tint-compiler.cpp` → 0; `cat-file -e` on the new test → absent.

⭐⭐⭐ **"GETTING A STACKED PR'S DIFF RIGHT DOES NOT GET ITS MERGE TARGET RIGHT, AND *MERGED* IS NOT *SHIPPED*."** ⛔ **My share, precisely: I found the base defect and fixed the WRONG HALF of it.** I diagnosed `base=master` as a **review-surface** problem (10 files vs 7; the maintainer re-reviewing approved work), recommended the retarget, and treated it closed when the file count dropped to 7. **The same field also sets the DESTINATION, and I never re-examined it in that second role.** ⇒ ⭐⭐⭐ **A FIELD WITH TWO SEMANTICS NEEDS CHECKING AGAINST BOTH** — the strand is not bad luck downstream of a good fix, it is the consequence of auditing one meaning of a two-meaning field. (`delete_branch_on_merge: false` ⇒ no auto-retarget ever fired.)

⛔ **DO NOT OPEN THE RECOVERY PR unasked.** Two independent reasons: (1) peer's — a second PR for work he already approved and merged once can read as re-litigating his action, and he may have intended a stacked-branch flow we cannot see; (2) mine — **"he mis-clicked" and "he merged the stack deliberately, intending to land `fix/issue-12342` → `master` himself" produce IDENTICAL observable state.** ⇒ ⭐⭐ **When two explanations fit the same evidence and one implies a maintainer error, ASK — never act on the reading that assumes the mistake.** Peer posted the finding + both options on #12375 (`issuecomment-5200495134`) for him to pick. **Surfacing, not fixing.** Recovery is measured and clean if he asks: `merge-tree --write-tree origin/master origin/fix/issue-12342` → exit 0, net **7 files +493/−16**, #12353's content NOT re-applied.

⭐⭐ **FIFTH WRONG-TREE MEASUREMENT, and the most insidious: a `git clone --shared` created before the merge SERVED THE PARENT REPO'S PACKED REFS and did NOT update on `git fetch`.** The peer's first pass reported "merging would duplicate #12353's content" (10 files / +936) — authoritative-looking, completely wrong, **and it would have argued for a rebase they'd then have performed on an approved head.** ⇒ the wrong-tree family producing an **ACTION**, not just a claim. ✅ **Two tells, now a precondition on any merge simulation: `git show <merge-sha>` prints NOTHING for a commit that exists, and `git rev-parse origin/master` DISAGREES with `git ls-remote origin refs/heads/master`.**

**Not broken for users:** #12342's own fix shipped with #12353 and the issue is correctly `CLOSED`. Only the sweep (`getVersionString`/`disassemble`/`disassembleWithResult` + the IR-dump consumer) is missing from master. **RESUME: jkwak-work picks the recovery path (branch PR or cherry-pick of `ba224921a1`).**

## ✅ ARMED: stranded-sweep guard `sweep12375-strand-guard-5ca1` (`*/30`, `bash /workspace/agent/sweep12375-guard.sh`)

**Why it exists: after #12353 merged I cancelled its guard (condition fired) and `slang-fixer` went quiet pending a maintainer answer — leaving the stranded sweep with NOBODY watching the deciding axis.** Exactly the gap [[feedback_ci_terminal_is_not_chain_terminal_arm_the_deciding_axis]] documents, arriving via *handoff completion* rather than mis-scoping: **each party correctly finished its part and the axis went dark in the seam.** ⇒ **When a chain's watcher is cancelled because its event fired, ask what the NEXT deciding event is before standing down.**

**Fires on either terminal event, never merge-only:** `SWEEP_LANDED` (sentinel `tools/slang-unit-test/unit-test-downstream-not-available.cpp` present on `master`) or `HUMAN_REPLIED` (a real human comment on #12375 after the bot's 04:46:52Z finding).

⛔⛔ **TWO DEFECTS FOUND BY CONTROL-TESTING, EITHER OF WHICH WOULD HAVE MADE IT USELESS — and the second is the worse one:**
1. **FALSE FIRE:** predicate was `user.type != "Bot"`, which counted **`jhelferty-nv`'s "PR board sync:" automation** (posted with `type=User`, 00:18Z, *before* the finding) as a human answer. First live run fired `HUMAN_REPLIED` with `human_comments: 2`. **A `type != "Bot"` test does not mean "a person replied".**
2. ⛔ **A GUARD THAT COULD NEVER FIRE:** the fix used `gh api --jq --arg ts …` — **`gh api --jq` does NOT accept `--arg`** (`accepts 1 arg(s), received 4`). That error was swallowed by `|| echo 0`, pinning `human=0` **permanently**. Live output read `resting` — *the answer I expected* — so nothing felt wrong. **Caught only because a control that SHOULD have fired didn't.** Fixed by emitting rows with `--jq` and filtering in `awk`; no `--arg` anywhere.

⇒ ⭐⭐⭐ **THE DEFECT THAT PRODUCES THE EXPECTED ANSWER IS INVISIBLE WITHOUT A MUST-FIRE CONTROL — and `|| echo 0` is a machine for converting a tooling error into a plausible datum.** Same family as `cmd && echo A || echo B` catching git's `fatal:` as a substantive answer. **Never let a fallback default swallow a command whose failure mode is an error message.**

✅ **Four controls, all behaving:** live → `resting`; date-filter-only → `resting` (name filter holds); **both filters dropped → FIRES `HUMAN_REPLIED`** (proves it *can* fire); control file broken → `PROBE BROKEN`, explicitly **not** a false "not landed". ⭐ **The `PROBE BROKEN` branch matters: without it an auth/path failure would report the sweep as un-landed forever, which is the silence-reads-as-nothing-happened defect in a guard's own output.**

## ⚠️ `master` MOVED — the recovery measurement is bound to a ref that has advanced (07:12Z)

**Peer flagged it; verified: `master` tip is now `9eb90c50a0`** ("Fix segfault on empty capability switch case (#12357)"), **not `9cd92bb3a1`** as I recorded twice. ✅ **#12353 is STILL shipped** — `compare/9cd92bb3a1...master` → `status=ahead, ahead_by=1, behind_by=0`, so the squash is an ancestor and only #12357 landed on top. Re-verified 07:10-07:12Z: **sweep still absent from `master`, no human reply on #12375.**

⇒ ⭐⭐ **The `merge-tree` recovery figure (7 files / +493/−16, exit 0) is bound to `origin/master` AS OF the run — it EXPIRES on every master advance. Re-run before quoting it.** Same class as the decayed CI conclusion and the stale resume note: **a measurement against a moving ref is a state claim.**

⛔⚠️ **TRAP surfaced while reconciling: `9cd92bb3a1`'s committer date is `01:55:50Z` but #12353 MERGED at `03:30Z`. Squash-merge REWRITES the commit date, so commit dates CANNOT order merges** — I nearly read the earlier date as evidence my `9cd92bb3a1` reading had been wrong. **Use the PR's `mergedAt`, or `compare/A...B` ancestry, never commit timestamps, to order squash merges.**

⭐⭐⭐ **PEER'S FINDING, and the most dangerous artifact defect of the chain: their `RESUME-12342-siblings.md` still read "PR: NOT YET OPENED" with "open the draft PR" as a remaining step** — **a restart reading it would have re-built, re-reviewed and RE-OPENED a PR that is already merged.** It went stale the instant the PR was created and was caught only incidentally. ⇒ ⭐⭐⭐ **A RESUME NOTE IS A STATE CLAIM AND DECAYS EXACTLY LIKE A CI CONCLUSION — and it is the worst place for staleness, because its entire audience is a context that has lost the ability to notice.** Every other stale artifact tonight misled someone who could double-check; a resume note misleads precisely the reader who cannot. **Re-read resume notes against live state whenever the chain's state changes, not when the note is next used.**

⭐⭐⭐ **`|| echo 0` — peer's three-part sharpening, adopted: (1) the fallback value is INDISTINGUISHABLE from a real measurement (`0` is what a healthy quiet channel returns), (2) it fails toward the EXPECTED answer so confirmation bias finishes the job, (3) it is PERMANENT, not intermittent — the flag never fires, so the watcher silently never watches.** ⇒ **NEVER LET A FALLBACK EMIT A VALUE THAT IS ALSO A LEGITIMATE OBSERVATION.** Emit a sentinel that cannot be mistaken for data (my guard's `PROBE BROKEN` branch), or let it fail loudly. ⭐ Sibling filed with it: **`user.type` describes the ACCOUNT, not the AUTHORSHIP** (`jhelferty-nv`'s board-sync bot posts as `type=User`).
