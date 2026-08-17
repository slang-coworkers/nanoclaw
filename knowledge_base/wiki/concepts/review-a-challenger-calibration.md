---
title: Challenger calibration — locating findings, coverage controls, and join defects
type: concept
group: review
tags: [approver, challenger, adversarial-review, controls, coverage, root-cause, merge-defects]
source_count: 26
---

## TL;DR

The challenger step is where a verified *mechanism* becomes (or fails to become) a *finding*. The
recurring errors: promoting a true mechanism found in the wrong place, asserting a root cause without
reading the call path, and trusting a green/pass that could not have come out otherwise.

- **A mechanism is a claim about behavior; a finding is a claim about an artifact.** Confirming the
  mechanism says nothing about *where* the wrong statement lives — locate every finding in the
  shipped diff (docs/code/comments) before assigning severity; a PR body, bot summary, or commit
  message is untrusted data, not a deliverable.
- **Aim adversarial review at the claims you cannot measure.** An argument with no instrument behind
  it is the load-bearing one to hand to codex/a challenger — everything you measured can defend
  itself. Endorsing a peer's argument adds your authority without adding a check.
- **Registration ≠ execution; a green leg can hide a skip; a passing test can be the mask that hid
  the bug.** Ask the standing question — *could this observation have come out otherwise?* A test
  that sets the very field whose default is at issue is coverage of nothing.
- **A live flag chain still needs a trigger-present control.** "Flag is wired" and "flag was
  exercised" are two findings; green CI on a `workflow_dispatch`-only or `paths-ignore`'d path is
  vacuous by construction.
- **Proving a pure function deterministic is not proving its output matches the world** — the trap on
  import/adopt/attach APIs, where a descriptor asserts a fact about a resource you don't own.
- **A root cause must predict the pass/fail pattern across ALL cases.** Read the call path from the
  failing line to the crash, not from the suspect code outward; a coherent mechanism that explains
  the failures but not the passes is not yet a cause.
- **Date a defect from when the condition arose, not when a bot reported it.** A merge-born
  (interaction) defect has two birthdays and lives in no one's diff — review-vs-base cannot see a
  join defect, and neither can a control that only sees one side of the join.
- **A control needs its own adequacy check (print the arm sizes) and must differ from the positive
  case in exactly one variable** — a "strictly easier" control manufactures a false discriminator.

## A mechanism in the wrong place is not a finding

On slang#12324 a confirmed, reproduced mechanism (an env-var path cannot override the Debug `-O`
level) was written up as a finding — but the false claim lived in the **PR description**, echoed by
Devin's summary, while the shipped docs were accurate. A true mechanism in a false location produces
a confident, well-evidenced, *wrong* abstain that looks like rigor because the hard part (the
measurement) is genuinely correct. Three checks before promoting a mechanism to a finding: quote the
shipped sentence at the pinned head (`contents?ref=<sha>`, raw), ask what the sentence's subject
actually is (here "base flags" = the variable env vars correctly populate), and ask whether the wrong
statement is in a deliverable (PR body/bot summary/commit message → not shipped; docs/code/comments →
shipped). Inherit neither an endorsement nor its retraction — re-run the probe; a relayed state
reading describes the instant it was made. [[approver/challenger-miss] A true mechanism in a false location is not a finding — locate the claim in the shipped diff (slang#12324)](wiki/learnings/1785844054713-approver-challenger-miss-a-true-mechanism-in-a-fal.md)

## Aim adversarial review at what you cannot measure

The generative selection rule: *an argument I can't measure is exactly what I hand to an adversarial
reviewer.* Everything measured (baseline hang, guard-proven test, suite counts) can defend itself;
spend the scarce adversary on the load-bearing claim with no instrument behind it. On slang#12343 the
fixer handed codex exactly the un-instrumentable bound and it confirmed a real hole. The paired
failure: **endorsing a peer's argument adds your authority without adding a check** — two agents
agreeing looks like corroboration but is one derivation with a second signature. Before endorsing,
ask what *independent* thing you verified; if the answer is "I read it and it seemed right," say that
or route it to something that can attack it. And "pre-existing, don't widen scope" is a legitimate
guard that *terminates inquiry* — verify the shape actually exists in the unpatched code before saying
it. A companion: **a test for a shape the pass never produces is worse than no test** (a vacuous guard
reads as coverage); contest a gate's must-fix *with an instrument*, not an argument.
[Aim adversarial review at the claims you cannot measure — and a peer's endorsement adds authority without adding a check](wiki/learnings/1785868570065-aim-adversarial-review-at-the-claims-you-cannot-me.md)

## Registration ≠ execution; the green-leg and the masking test

**"A test exists and CI is green" ≠ "the test ran."** A GPU-touching test can skip/xfail at
`get_device()` on a paravirtual runner while the job still concludes `success` — a green leg is that
pattern's *affirmative signature*. Parametrization decides at collection time
(`DEFAULT_DEVICE_TYPES`), so registered ≠ executed. Grep the pytest line by name in the job log
(fetchable anonymously on public repos): `PASSED` vs `SKIPPED` on the exact parametrized id is the
whole answer — and check *which branch* the parameter took, since a `pytest.raises("not
implemented")` branch "PASSES" without exercising the feature. Require: collected for the target
parameter, some CI job runs the step on that platform, the log shows `PASSED` for that id, and the
assertion reached is the feature not a guard.
[[approver/clause-gap] Registration is not execution: read the pytest line by name, and a green leg can hide a skip](wiki/learnings/1785935849178-approver-clause-gap-registration-is-not-execution-.md)

**A default-value fix whose existing test sets that field explicitly: the test is the mask that hid
the bug, not coverage.** On slang-rhi#813 `fixupBufferDesc` only writes `defaultState` when
`Undefined`, and the one existing test sets `defaultState = UnorderedAccess` explicitly — so the
function is an exact no-op there, the test carries zero bits about the change, and that is *why the
defect survived for months*. When a PR fixes behavior on a default-value path, open the test and check
whether it sets the very field whose default is at issue; if it does, "the existing test passes" is a
false-safe. The distinguishing test for "can I clear this by reading?" is not "did I read the source?"
but *"is the change small and monotone enough that reading exhausts the state space?"*
[[approver/challenger] A default-value fix whose existing test SETS that field explicitly: the test is the MASK that hid the bug, not coverage](wiki/learnings/1785936477454-approver-challenger-a-default-value-fix-whose-exis.md)

**Two verification patterns for a PR that adds a checker.** (1) *Mutation-test the selftest* — a
passing selftest says nothing about whether it *can* fail; seed the exact defect class the PR exists
to fix and confirm two targeted failures with correct expected values, then restore. (2) *Check a
"resolved" finding behaviorally, not by name* — `hasattr(module, "_gh_slug") == False` cannot
distinguish resolved-correctly from resolved-wrongly; drive both implementations against the external
ground truth including the divergent cases. And "wider" is two-directional: a widened detector must be
driven against the cases it must *reject*, and a change that fixes a blind spot with no current
occurrences *closes a hole*, it does not *fix a live bug*.
[[approver/procedure] Mutation-test a selftest, and check a "resolved" finding behaviorally — a passing test and a deleted symbol both prove nothing](wiki/learnings/1785863623589-approver-procedure-mutation-test-a-selftest-and-ch.md)

## Coverage: a live flag chain still needs a trigger-present control

**"Flag is wired" and "flag was exercised" are two independent findings.** On slangpy#925 the
dead-flag probe passed (the setter exists, the chain is unbroken) and CI went green — but `wheels.yml`
is `workflow_dispatch:`-only, so the authoritative build cannot run on a PR branch, and every `ci.yml`
leg took the CMake default `OFF`. Green CI is exactly what a no-op-on-the-default-path change produces
— zero bits. After the dead-flag probe passes, ask as a separate step: *which concrete CI job runs
with this flag ON?* Name it or it does not exist. Zero condition-true coverage on a conditional change
that undermines the PR's stated purpose = `OPEN_GAP`, not a nit; before citing green CI as safety,
run the positive control *could this green have gone red given what the change touches?*
[[approver/challenger-miss] A live flag chain still needs a trigger-present control — CI green on a workflow_dispatch-only path is vacuous by construction](wiki/learnings/1785935492347-approver-challenger-miss-a-live-flag-chain-still-n.md)

## Determinism is not correctness — the import-API trap

**A pure function's provable behavior is a claim about the function, not about the state of the
external object it describes.** On slang-rhi#813 the descriptor rewrite was verified exhaustively —
pure, monotone, deterministic — and treated as correctness. The claim the change actually makes is
that *an externally-owned buffer is in the usage-derived state*; if the owning app left it in COMMON,
the assumption and the emitted barriers are wrong. The distinction bites hardest on
import/adopt/attach APIs, where a descriptor is an assertion about a resource the library does not
own. Two secondary tells: **"the maintainer did this elsewhere" answers *is this approach sanctioned?*,
never *is this instance correct?*** and **a trace supporting "X is broken" does not support "therefore
Y is correct"** — the second needs its own evidence.
[[approver/challenger-miss] Proving a transform is deterministic is not proving its output matches the world — the 4th round-up on "found it, wrote it down, cleared it"](wiki/learnings/1785937086901-approver-challenger-miss-proving-a-transform-is-de.md)

## A root cause must predict every case, not just the failures

**A plausible adjacent defect is not a root cause.** On slangpy#1090 a genuine nearby defect
(`m_memory` left indeterminate) was named as *the* cause of a Vulkan crash — but the failing test's
call path creates a separate staging buffer and never maps the imported buffer's `m_memory`. The real
cause was an `Undefined` resource state reaching a Vulkan barrier (`fixupBufferDesc` skipped on the
import path). The discriminating question: *does my mechanism predict the observed pass/fail pattern
across ALL cases, and does some other mechanism predict it better?* The `m_memory` story explained
none of the passing cases (`m_memory` is equally uninitialized on d3d12, which passes). Read the call
path from the failing line to the crash (not from the suspect code outward), get a stack if one exists
(one platform's silence is not absence of evidence), and count the legs before theorizing. Record
adjacent-but-unfired defects in a separate field so they are reported without contaminating the causal
claim. [[approver/challenger-miss] I asserted a crash mechanism without reading the call path — the counterfactual test that catches it](wiki/learnings/1785935824264-approver-challenger-miss-i-asserted-a-crash-mechan.md)

## Dating a defect: merges, birthdays, and one-sided joins

**Date a risk from when the condition arose, not when a bot reported it — and a semantic conflict's
birthday is the merge that first co-located both halves.** On slangpy#925 a defect was an interaction
between two individually-correct edits that arrived separately; it was born at merge `e5f2299b2b63`,
present in **neither parent**. Three candidate birthdays (the branch's edit, the merge, CodeRabbit's
report) and only the merge is right. A merge-born defect belongs to nobody's diff — review-vs-base
sees the intended one-line addition and nothing reveals the distant line it now shadows. For "when did
this start," enumerate candidates and pick the earliest commit where **all** conjuncts of the hazard
are true together, testing both parents of a suspected merge; and don't let a report's chosen mechanism
(a version bump) reset the clock — it changes severity, not onset. Getting the direction wrong inverts
the ask from "look at something new" to "re-examine something you signed off on."
[[approver/challenger-miss] A merge-born defect has TWO birthdays — date it from the merge that created the interaction, not the PR's first commit](wiki/learnings/1785939814762-approver-challenger-miss-a-merge-born-defect-has-t.md)
[[approver/challenger-miss] Date a risk from when the condition arose, not when a bot reported it — and for a semantic conflict, that date is the merge that first co-located both halves (neither parent had it)](wiki/learnings/1785941778863-approver-challenger-miss-date-a-risk-from-when-the.md)

**Never characterize a merge without replaying it.** The "textually clean merge, invisible to every
conflict marker" story was asserted, not measured — the merge actually *conflicted*, in the exact
defect file, and was hand-resolved into the shadowing pair. Worse, filing it under "invisible to every
marker" builds a detector for *silent* merges that would have skipped this very (loud) PR. Replay:
`git merge-tree --write-tree --name-only A B` (exit 1 ⇒ conflicts) and `cmp` the result against both
parents (≠ both ⇒ hand-mixed). The refinement: the conflict hunk showed only the global+`_LINUX` pair
while the other half auto-merged 108 lines away — **conflict-region review is itself a one-sided view
of the join.** The surviving generalization across all these: **a check that only ever sees one side
of a join cannot see a join defect** — same shape as 17 green CI legs covering none of the diff.
[[approver/challenger-miss] I filed "textually clean merge" without replaying the merge — it conflicted, in the defect file, and the fix is a conflicted-file probe not a marker-absence one (the other half arrived 108 lines away, auto-merged)](wiki/learnings/1785942198712-approver-challenger-miss-i-filed-textually-clean-m.md)

## A control is an instrument — build it to differ by exactly one variable

**A negative control that is too easy manufactures a false discriminator.** Testing whether git
2.39's old 3-arg `merge-tree` distinguishes a conflict, a *different-files* clean pair made
`changed in both` read as a 1-vs-0 discriminator — but the real case was *same-file, both edit*, where
the string hits 1 in both and discriminates nothing. A negative control only excludes the
alternatives it exercises; build it to differ from the positive in **exactly one variable**, and ask
*is my clean case a strictly easier instance than the real one?* A discriminator is established only
by the clean run — the conflicting case "confirms" every candidate.
[[approver/challenger-miss] A negative control that is too easy manufactures a false discriminator — my "clean" case used different files, which would have licensed grepping a string that fails on the real same-file case](wiki/learnings/1785942523284-approver-challenger-miss-a-negative-control-that-i.md)

**"Strictly easier" reduces to the one-variable rule.** A degenerate case is degenerate *because the
system special-cases it*, and that special-casing is the hidden second variable — usually the one that
makes the case look safe (`total_count: 0 → pending` vs a lone context → vacuous `success`;
different-files vs same-file). Keep one clause: a control must differ in exactly one variable; demote
"strictly easier" to its diagnostic. Corollary: **the degenerate case is the one the system handles,
so the failure lives one step in from it** — audit `total_count: 1`, not `0`; test
same-file-non-overlapping, not different-files. [[approver/clause-gap] "Strictly easier" is not a second axiom — it reduces to the one-variable rule, because a degenerate case always differs by an extra variable (the special-case handling that makes it degenerate)](wiki/learnings/1785942834410-approver-clause-gap-strictly-easier-is-not-a-secon.md)

**A control needs its own adequacy check — print the arm sizes.** A causal claim was refuted on an
n=2 arm; the adequate re-run (n=29/n=14) merely *softened* the mechanism rather than cleanly refuting
it. A small-n result that points the right way is the most dangerous kind — a later adequate run reads
as confirmation. The adequacy check needs its own matcher check (a silent extractor yielded 4 tokens),
and when a rate is underpowered, **fall back to mechanism-per-case** — causes are per-case facts and
need no sample. The instrument you just built to check someone else is the one you are least likely to
check. [[approver/challenger-miss] A control needs its own adequacy check — I refuted a mechanism on n=2 in the same breath as praising myself for testing it](wiki/learnings/1785943660571-approver-challenger-miss-a-control-needs-its-own-a.md)

## Discharge cheap advisories; scope every absence claim

**Discharge cheap advisory flags instead of forwarding them.** A Devin "Investigate" flag ("verify
the workflow `name:` fields match") was forwarded across four reports as an open item and nearly
published as a real defect — a 2-file, ~10s lookup settled it as a false positive. An unresolved
advisory repeated N times reads to the recipient as a confirmed defect with N confirmations. Two
classes to always discharge, never forward: "do these names/IDs/paths match?" and "is this flag
actually set anywhere?" On an ABSTAIN the advisory list *is* the report's entire informational
payload to the human, so a wrong advisory is the one way an abstain misleads. Note the asymmetry: for
a *gating* gap, uncertainty ⇒ ABSTAIN; for an *advisory* item, uncertainty ⇒ go look.
[[approver/challenger-miss] discharge cheap advisory flags instead of forwarding them — a 2-file lookup would have killed a false positive I relayed 4×](wiki/learnings/1785856625138-approver-challenger-miss-discharge-cheap-advisory-.md)

**Scope every "unused / 0 references" absence claim.** Two boundaries make an in-repo grep
insufficient: cross-repo reusable workflows (`secrets: inherit` sends *every* caller secret across
the boundary — check for it first) and code-references ≠ settings-state (the contents API sees files,
not repo/org secret settings, so "no workflow references it" supports "safe to remove," never "it's
already gone"). State the scope in the claim: "0 references across N files in `<repo>@<ref>`; callers
pass explicitly; settings state not inspected." [[approver/challenger-miss] scoping an "unused secret / 0 references" absence claim: state inherit-vs-explicit for reusable-workflow callers, and never conflate code refs with settings state](wiki/learnings/1785856892802-approver-challenger-miss-scoping-an-unused-secret-.md)

## Read the requirement and the citation before scoring

**A grep hit's line number is not a step attribution — read the enclosing `- name:` before claiming
what a CI `if:` guards.** On slangpy#1078 a `runner.os != 'macos'` hit was bound to the test step; it
gated a PyTorch-setup step, and the real test step had no macOS exclusion — inverting a coverage
claim. `grep -c` first (>1 hit ⇒ no single hit supports an attribution), resolve upward to the owning
step, then find the step you care about by name. `contains(matrix.flags, 'unit-test')` appears on many
steps because it gates the whole job — its presence says nothing about which step you're looking at. A
false negative-coverage claim is the direction that erodes trust in an abstain.
[[approver/challenger-miss] A grep hit's line number is not a step attribution — read the enclosing `- name:` before claiming what a CI `if:` guards](wiki/learnings/1785856953525-approver-challenger-miss-a-grep-hit-s-line-number-.md)

**Parse a requirement's logical form before scoring it — and resolve "who said this?" per utterance.**
On slang#12080, "either remove the loop **or** justify it strongly" was scored `❌` by checking only
the first branch, when the second (24 comment lines + two dedicated tests) was taken deliberately; and
a 07-23 "plan" attributed to the human author was authored by `nv-slang-bot[bot]` — our own shared
identity. Scan for `or`/`unless`/`alternatively`/`at minimum` and enumerate every branch; check
`user.login`/`user.type` on the *specific* comment id; before reporting non-compliance about a named
person, verify the obligation was theirs (author, committer, and pushes are three fields answering
three different questions). Compounding two true facts through an unchecked bridge produces something
worse than either error alone. Ownership resolves against the push log (`timeline?event=
head_ref_force_pushed`, all pages), never the `author` field (preserved across force-push by design).
[[approver/challenger-miss] I read one branch of a maintainer's disjunction as a broken promise — and attributed our own bot's commitment to a named human engineer](wiki/learnings/1785934117511-approver-challenger-miss-i-read-one-branch-of-a-ma.md)

**"Who spoke last" cannot express "human asked, bot spoke after, human still unanswered."** A
last-actor predicate mistakes bot noise for a change of turn — on a bot-heavy repo, "human asked, bots
spoke after, human still unanswered" is the *common* shape, so a maintainer design objection on
slang#12080 was dropped silently (newest actor = bot ⇒ `awaiting_human` ⇒ no nudge). Ask "is any human
utterance unanswered?", never "who spoke last?" — filter bots out first, then compare the newest
remaining human event against your own last outbound. And a *characterization* ("author mid-burst,
informational") does not look stale, so it silently persisted 31h after it stopped being true —
re-derive characterizations, not just counters. A fix validated by matching another agent's verdict is
validated by nothing: two agents quoting one measurement is one measurement wearing two names; the
correct validation is per-case and mechanical. And measure the raw page length for a pagination
decision, then filter — a `--paginate` walk can splice an `app_not_connected` error into a partial
array with no error exit. [[approver/clause-gap] "Who spoke last" cannot express "human asked, bot spoke after, human still unanswered" — and a fix validated by matching another agent's verdict is validated by nothing](wiki/learnings/1785890209109-approver-clause-gap-who-spoke-last-cannot-express-.md)
[[approver/clause-gap] The `>= per_page` pagination guard is BLIND when you jq-filter inside the page — measure the RAW page length, then filter](wiki/learnings/1785933892685-approver-clause-gap-the-per-page-pagination-guard-.md)

**Enumerate bots by `__typename`/`type == "Bot"`, not by a login convention.** The `[bot]` suffix is
present in REST `login` and *absent from GraphQL's* — so `endswith("[bot]")` on GraphQL classifies
every bot, including your own `nv-slang-bot`, as **human** (the dangerous direction — an unclassified
actor read as human makes a stale chain look attended). And `slangbot` is `type: User` on both
surfaces (an app-less bot no type rule catches), so the honest design is `type == "Bot"` plus a named
supplement. A login-shape convention does not transfer across REST and GraphQL; two agents agreeing on
the wrong `[bot]` filter is the shared-verdict failure again — what settled it was querying both
surfaces and diffing the logins. [[approver/clause-gap] CORRECTION: my `[bot]`-suffix bot filter is WRONG on GraphQL — the suffix exists in REST and not GraphQL; use `__typename`/`type`, and know that `slangbot` is `User` on both](wiki/learnings/1785890627181-approver-clause-gap-correction-my-bot-suffix-bot-f.md)

**A bot that edits in place makes "unedited" an observation, not an absence of one.** cla-assistant
*edits its badge comment in place* when the answer changes (verified on a control: the edit landed 5s
after a force-push that changed the commit author identity). So an *unedited* CLA comment means "the
answer never changed" (the account has not signed), inverting the tempting reading "nobody re-ran it —
maybe already signed." Whether silence carries information depends on whether the writer *would have
spoken* — testable against a control, never assumed. The wrong inference here made an expensive fix (7
commits re-authored, dismissing a standing approval) look possibly-free, and arrived as *credit*
chasing the author's own caveat — the exculpatory branch gets audited least; test it first. Probe
commit authorship with `any(.author.id == <id>)` over all commits, never a single index.
[[approver/clause-gap] cla-assistant EDITS its badge comment in place — an unedited comment means no re-evaluation, not "maybe already signed"](wiki/learnings/1785887757566-approver-clause-gap-cla-assistant-edits-its-badge-.md)

**A finding that emerges mid-session needs its own store search, and dedup is per-CLAIM.** The Step-0
recall covers the question you started with, not the one you ended up answering — treat "I have a new
finding" (especially a *harness* finding, or one you'd call "defect/gap/novel") as a trigger for a
fresh store search keyed on the artifact you're now looking at. And re-run dedup after the critique
stage: a reviewer's adjacent finding is a new claim with its own signature (a *hang*, not the *assert*
you searched for) — on slang#12361 the maintainer had filed it 30 minutes earlier. Retry zero-hit
coverage checks in the target's vocabulary before claiming novelty; measure a relayed "reachable"
claim (a two-state test) rather than relaying it.
[[approver/challenger-miss] A finding that emerges mid-session needs its OWN store search — the Step-0 recall covered the question you started with, not the one you ended up answering](wiki/learnings/1785863354984-approver-challenger-miss-a-finding-that-emerges-mi.md)
[Re-run dedup AFTER the critique stage — a reviewer's adjacent finding is a NEW claim needing its own search](wiki/learnings/1785920058963-re-run-dedup-after-the-critique-stage-a-reviewer-s.md)

## Ancillary attribution corrections (same slangpy#925 / #1090 chain)

Two "correct conclusion, wrong supporting membership" corrections worth their scope, both resolved by
*printing the per-item result rather than describing it*: `metal-buffer.cpp` was named as the bug site
when it is the **contrast** case (the backend that *calls* `fixupBufferDesc`, i.e. why Metal passes) —
label each cited path `bug | crash | contrast | control` before asserting; and `vk-buffer.cpp` is
byte-identical at both submodule shas with its lone `fixupBufferDesc` call in `createBuffer:340`, not
the import path `:441` — the asymmetry is intra-file (`grep -c` then locate the enclosing scope; an
occurrence count of 1 in the wrong scope reads identically to 0). Both confirm the Vulkan defect is
**pre-existing and newly reached**, not introduced — two cheap queries (`compare` file list, and the
symbol at the old ref) settle "introduced vs merely reached," a materially different thing to tell an
author. [[approver/challenger-miss] I named metal-buffer.cpp as the bug site when it is the CONTRAST case — the Vulkan defect is pre-existing and merely newly reached, and #1090 is not an instance of a gitlink hiding a bug](wiki/learnings/1785939319520-approver-challenger-miss-i-named-metal-buffer-cpp-.md)
[[approver/challenger-miss] vk-buffer.cpp is byte-identical at both submodule shas — and its lone fixupBufferDesc call sits in createBuffer (:340), not the import path (:441): the asymmetry is intra-file](wiki/learnings/1785939465570-approver-challenger-miss-vk-buffer-cpp-is-byte-ide.md)
