---
title: "Approver decision procedure — clause pipeline, policy resolution, ledger recording"
type: concept
group: review
tags: [approver, clause-gap, policy-staging, ledger, critique-gate, infra-abstain, false-negative]
source_count: 18
---

## TL;DR

The PR-approver runs a **staged pipeline**: Step-1 deterministic eligibility clauses
(`eval-clauses.py`) → Step-2 review-verdict parse → Step-3 severity judgment → Step-4
recording. Each stage is a distinct gate; passing one only means the next *runs*.

- **A status value is an interface, not a description.** Never propose a new enum/status
  without reading the consumer — an undefined value either abstains everything or falls
  through to the permissive path. Compute blast radius against the *current* policy.
- **Policy resolution has four tiers**, and the per-PR staged pin (`<ws>/policy/`)
  **outranks** the group mount. A staging fallback to the skill-bundled default silently
  reverts *all six* policy axes at once — the clause that fires is incidental.
- **Staleness is era-relative:** judge a pinned policy against the version in force *at
  its own timestamp*, not against today's. Comparing to "now" manufactures one false
  positive per policy transition.
- **"Clause-eligible" ≠ "approvable."** Report the corrected *derivation*, never the
  corrected *outcome*, until the next stage has actually run.
- **A false-negative (spurious abstain) fails in the socially-invisible direction** —
  caution reads as caution, nothing alerts. Join recorded ABSTAINs against
  merged-and-approved outcomes to find them; require **head alignment**.
- **`WOULD_APPROVE`/`BLOCK` are critique-gated; `ABSTAIN_*` are gate-exempt.** Correcting a
  false-negative costs more than making it did. Use `record_human_verdict` (ungated) to
  stamp the human outcome onto the existing row instead of re-recording a decision.
- **A "deterministic" clause reading an agent-authored field is not deterministic** —
  re-point it at the raw harvest, an artifact the agent cannot write.
- **Pick the reason code that names the root cause**, not the one the flowchart reached
  first: a pipeline gap is `ABSTAIN_INFRA` (alerts, excluded from scoring), never
  `ABSTAIN_POLICY` (which disguises a defect as intended behavior).

---

## The pipeline is a sequence of independent gates

`eval-clauses.py` runs Step-1 eligibility clauses and maps outcomes:

```
any clause FAIL        -> ABSTAIN_POLICY (reason CLAUSE_FAIL:<name>)
any clause UNEVALUABLE -> ABSTAIN_INFRA  (reason CLAUSE_UNEVALUABLE:<name>)
all PASS               -> continue to the verdict parse (Step 2)
```

Passing Step 1 means Step 2 *runs* — it says nothing about the outcome. The most expensive
class of error here is inferring a downstream result from an upstream fix: after finding a
spurious `CLAUSE_FAIL`, claiming the PR was "WOULD_APPROVE-eligible" reads as a verdict, and
if the actual review doc says `REQUEST_CHANGES` with open gaps, that phrase is false in the
*permissive* direction — the single most damaging thing an approver can emit, because it is
the claim that gets a shadow-mode measurement program shut down. Say **"would have reached
Step 2"**, never "was approvable." Read the next stage's input (`review-doc.md`'s
`_approver_result`/`verdict`/`gaps`) before quoting any outcome. A fix to one stage does not
predict the outcome of the next, and inferring N outcomes from one clause state multiplies
the error [[approver/clause-gap] "Clause-eligible" is not "approvable" — I let a Step-1 fix imply a Step-2 outcome and it propagated to an operator; #925's review verdict is REQUEST_CHANGES with 2 gaps, so the spurious clause changed the REASON, not the decision](../learnings/1785944803906-approver-clause-gap-clause-eligible-is-not-approva.md).

The same discipline applies to proposing new status values. Splitting `ci_green_on_sha` into
`pass`/`unevaluable`/`not_applicable` felt strictly-safer, but the consumer has only three
buckets: a `not_applicable` falls through every bucket (silently treated as satisfied — a
worse, silent false-safe), and reusing `unevaluable` for a global waiver would map 100% of
shadow decisions to `ABSTAIN_INFRA`, destroying the measurement program. **"Conservative" is
not a synonym for "correct."** A CI-waiver belongs at the *reporting* layer (a
self-indicting, machine-greppable evidence string plus a decision-record caveat), keeping
`status: "pass"` so the pipeline continues, never at the status layer
[[approver/clause-gap] My own three-outcome fix was wrong in the third outcome — the evaluator maps unevaluable→ABSTAIN_INFRA, so a `not_applicable`/`unevaluable` waiver would abstain 100% of shadow decisions; the waiver must stay non-blocking and be fixed at the reporting layer](../learnings/1785944050080-approver-clause-gap-my-own-three-outcome-fix-was-w.md).

## Policy resolution: four tiers, and the pin that outranks the mount

`eval-clauses.py:267-283` resolves policy in this precedence order:

```
1. --policy PATH                                        (explicit; bypasses everything)
2. per-PR staged pin: <ws>/policy/APPROVAL_POLICY.json  ← WINS over the mount
3. group mount: /workspace/extra/approver-policy/APPROVAL_POLICY.json
4. skill-bundled default (v0-shadow)
```

The group mount exists precisely as the lever for relaxing shadow-mode clauses without
editing the bundle — yet a per-PR artifact outranks it. When staging **falls back** to the
bundled default (rather than copying the live mount), it writes `v0-shadow` into
`<ws>/policy/`, where precedence 2 then loads it over the human-signed mount. Because the
bundled default is uniformly stricter on **all six axes** (`trusted_associations` 3 vs 7,
`allow_fork_head` false vs true, `require_ci_green` true vs false, `protected_paths` 8 vs 1,
caps 400/30 vs 8000/150), a fallback pin reverts *every* relaxation simultaneously — and
**which clause fires is incidental** to whatever the PR happened to touch (fork head, author
association, path, size, CI). Naming the mechanism after the one clause you observed scopes
the fix too narrowly ("the `.github/**` widening isn't taking effect") and leaves the other
reversions alive [[approver/clause-gap] CRITICAL: a per-PR staged policy/ snapshot takes precedence over the group-mounted policy (eval-clauses.py:277-281), silently overriding a human-signed widening — 21 of 57 run workspaces decided under a stale policy, all failing MORE conservatively](../learnings/1785944417080-approver-clause-gap-critical-a-per-pr-staged-polic.md)
[[approver/false-safe] Re-derived all 4 fallback-pinned decisions: 1 genuine FALSE-NEGATIVE (#918 = WOULD_APPROVE recorded as abstain), and 3 of 4 failed on clauses unrelated to protected_paths — a fallback pin reverts the ENTIRE policy, not one widening](../learnings/1785944951948-approver-false-safe-re-derived-all-4-fallback-pinn.md).

The two live machinery defects behind this:

1. **`SKILL.md` documented 2 policy tiers against an implemented 4** — it called
   `<ws>/policy/` "mounted" (it's the per-PR pin, tier 2; the real mount is tier 3) and
   omitted that the pin outranks the mount. A contract that under-describes its own
   resolution order is an active hazard, because the staging step *follows* it. **When a doc
   and its implementation disagree about how many tiers exist, the count mismatch is the
   defect.**
2. **`clauses.json` recorded `policy_version` but not the source path** — tiers 2-4 can hold
   different files carrying the same version string, which is why diagnosing this took eight
   rounds of archaeology. Fix: `result["policy_path"] = os.path.abspath(policy_path)`.

Both were fixed and verified by *running* the code (not assuming the edit took): the recorded
run's stale `v0-shadow` pin gave `no_protected_paths` FAIL, while the same inputs under the
signed `v0-shadow-wide` gave all six clauses PASS — re-confirming the finding from the
opposite direction [[approver/clause-gap] The staging-fallback root cause is the SKILL DOC: it calls <ws>/policy/ "mounted" when precedence 2 is a per-PR copy — and my two code fixes land in an externally-synced skill, so they need an upstream PR, not a local edit](../learnings/1785946364203-approver-clause-gap-the-staging-fallback-root-caus.md)
[[approver/clause-gap] Both live defects FIXED and verified by execution — SKILL.md now documents all 4 policy tiers with the pin-outranks-mount warning, and clauses.json now records policy_path; the test run independently re-confirmed #925 from the other direction](../learnings/1785949248172-approver-clause-gap-both-live-defects-fixed-and-ve.md).

**Interim mitigation, available with no code change:** pass `--policy <mount>` explicitly
(tier 1) on every invocation. This is also the correct pre-flight for re-deriving affected
workspaces whose stale pins are still on disk — re-deriving *in place* with default
resolution reproduces the bug, because precedence 2 reloads the poisoned pin.

### Staleness is era-relative, and the two pre-flight guards answer different questions

Judging a pinned policy against *today's* version manufactures a false positive per policy
transition. An initial "21 of 57 workspaces stale" collapsed to **4** once each snapshot was
compared to the version in force at its own staging mtime: 17 pins were era-correct (pinning
the then-current policy at decision time is correct auditability behavior). The 4 real ones
were byte-identical (`cmp -s`) to the bundle — the staging-fallback signature; the era-correct
17 differed from the bundle (negative control). **Over-calling a real finding is its own
defect** — an inflated blast radius drives worse remediation than the true one; quantify with
the same discipline used to detect [[approver/clause-gap] CORRECTION to my own 21/57 policy-staleness claim — 17 were era-correct; the real defect is 4 runs where STAGING FELL BACK to the skill-bundled default (byte-identical) and precedence 2 then loaded it over the mount](../learnings/1785944681943-approver-clause-gap-correction-to-my-own-21-57-pol.md).

Two guards, two distinct questions — using either for the other's job fails:

| question | correct guard (reference) | result |
|---|---|---|
| "Did the staging bug affect this run?" | pin version vs policy in force **at that run's date** (era-relative) | 4 |
| "Safe to re-derive in this workspace *now*?" | pin version vs the **live mount** | 21 |
| "Is this pin a bundled-fallback artifact?" | `cmp` vs bundle (**brittle**: silent if the bundle ever updates) | 4 |

Both "wrong" answers are right for the other question. **A guard reused from a diagnosis
inherits the diagnosis's assumptions** — `cmp`-vs-bundle depends on a reference nobody
promised to hold still, so it needs the bundle's version asserted. Ask of any check: *what
would have to change elsewhere for this to silently stop working?*
[[approver/clause-gap] The cmp-vs-bundle pre-flight and the version-vs-mount pre-flight answer DIFFERENT questions — cmp catches exactly the 4 staging-bug workspaces but goes silent if the bundle ever updates; version-vs-mount flags 21 (correct for re-derive, wrong for bug detection)](../learnings/1785945526002-approver-clause-gap-the-cmp-vs-bundle-pre-flight-a.md).

## False-negatives: the spurious abstain that fails in the invisible direction

Re-deriving the 4 fallback-pinned runs per-run (never per-class, always era-relative) found
one genuine **false-negative**: `slangpy#918` failed `head_provenance` on `allow_fork_head:
false` (bundled default), but ran when `v0-shadow-relaxed` was in force — which already had
`allow_fork_head: true`. Its review was clean (`APPROVE`, 0 bugs, 0 gaps), and the head it
decided (`57259b457b4c`) is the exact head that merged, with human `ccummingsNV` `APPROVED`.
So the fallback destroyed a correct-agreement datum [[approver/false-safe] #918 human-confirmed: re-derived WOULD_APPROVE agrees with ccummingsNV APPROVED + MERGED at the SAME head I decided — the staging fallback destroyed a correct-agreement datum, and conservative-direction bugs cost calibration signal rather than triggering alarms](../learnings/1785945140067-approver-false-safe-918-human-confirmed-re-derived.md).

This inverts the usual severity intuition. Every *other* defect in the chain was a check
*passing* for the wrong reason (caught eventually, because something breaks). A spurious
abstain **fails** for the wrong reason: nothing merges that shouldn't, no human is misled
toward risk, **no alarm fires** — the entire cost is measurement signal in a shadow programme
whose only product is agreement scoring. It can run indefinitely. Detection requires actively
joining recorded ABSTAINs against merged-and-approved outcomes:

```bash
gh pr view $PR --repo $R --json state,mergedAt,mergedBy,headRefOid,reviewDecision,isCrossRepository
# recorded ABSTAIN + merged + reviewDecision:APPROVED + Step-2 APPROVE/0-gaps -> FALSE-NEGATIVE
# decided head != merged head -> weaker claim, say so
```

A broader join found the false-negative set was **8 of 28 joined abstains (29%)**, every one
from the same change class: onboarding a repo to the reusable `pr-board-sync.yml` (thin
caller workflows under `.github/`, delegating to a callee at `@master`). This is quantified,
after-the-fact support for the human-signed `v0-shadow-wide` widening — the pre-widening
`no_protected_paths` predicate was not slightly conservative but **dominant** on this class.
Every flag had a **compensating control in a place the caller diff doesn't show** — the callee
documents the pattern (`permissions: {}` is required by the reusable workflow's PAT design),
or a sibling file in the same PR is the mitigation (a nightly sweep bounds assignment drift
to ≤24h). **Severity can require reading the callee or a sibling file, not just the diff.**
Caveat: 29% is a rate over decisions, not independent PRs (28 abstains span ~10 PRs) — don't
quote it as a per-PR rate [[approver/false-safe] All 8 soft rows resolved — false-negative set is 8 of 28 abstains (29%), every one from the same board-sync onboarding change class, and every flag was advisory-by-design with a compensating control in the callee or a nightly sweep](../learnings/1785948953523-approver-false-safe-all-8-soft-rows-resolved-false.md).

## Recording: the critique-gate asymmetry and the ledger instrument

Step-4 recording (`SKILL.md:142-153`) gates asymmetrically:

- `ABSTAIN_POLICY` / `ABSTAIN_INFRA` assert nothing about the code ⇒ **not** critique-gated.
  Skip DECISION_REVIEW/OUTPUT_REVIEW, call `record_decision`, stop.
- `WOULD_APPROVE` / `BLOCK` ⇒ **full critique gate**, both stages; you cannot author/edit
  verdict state.

The design is sound (an abstain says "a human must look," safe by construction) but creates a
**ratchet**: the cheapest output (abstain) has the highest correction cost *and* the errors
hardest to walk back (the invisible false-negatives). "Re-record #918/#1002 as WOULD_APPROVE
for calibration" sounds like bookkeeping; it is actually two fresh gated decisions on merged
PRs. **A correction inherits the ceremony of its destination, not of its origin** — read the
gate rules for the *target* state [[approver/critique-mustfix] "Re-record #918/#1002 as WOULD_APPROVE" is not bookkeeping — WOULD_APPROVE is critique-gated (DECISION_REVIEW + OUTPUT_REVIEW) while the original ABSTAIN_* rows were gate-exempt, so correcting a false-negative costs strictly more than making it did](../learnings/1785947515759-approver-critique-mustfix-re-record-918-1002-as-wo.md).

The right instrument sidesteps the whole binary. `record_human_verdict` (ungated — it joins a
verdict, not a decision) stamps the human outcome onto the **existing** ABSTAIN row, so the
disagreement `decision=ABSTAIN_POLICY` beside `human_verdict=APPROVED` is computable from the
ledger with no reconstructed decision, no gate bypassed, no silent denominator. **Don't choose
between two bad options when a third instrument exists** — a well-aimed constraint ("the gap
must be discoverable from the ledger, not just your notes") beats choosing among the options
on the table. Standing: after building an outcome-join detector, *stamp* what it finds rather
than reporting it in prose; prose findings never reach whoever computes the statistics. The
merge-events not auto-stamping is itself the more general defect [[approver/false-safe] The ledger-gap problem had a purpose-built ungated answer already: record_human_verdict stamps the human outcome onto the EXISTING ABSTAIN row, making the disagreement computable from the ledger without writing a reconstructed WOULD_APPROVE](../learnings/1785947747666-approver-false-safe-the-ledger-gap-problem-had-a-p.md).

But **a write whose effect you cannot verify is not an accomplished fact.**
`record_human_verdict` is a documented host-side **no-op when no decision row exists** — and a
no-op almost certainly returns the same success string as a real stamp. With only 1 of 57
workspaces retaining a `record-payload.json` (the artifact of a `record_decision` call),
pre-fix decisions may never have reached the ledger at all, leaving nothing to attach to.
For any write tool: read its no-op conditions, **verify through a different channel than the
one you wrote through**, and if no read channel exists, **report the action, not the effect**
("I issued stamps whose effect I cannot verify"). Never let "I found the right mechanism"
substitute for "the mechanism did something" [[approver/critique-mustfix] I reported "the disagreement is now computable from the ledger" but record_human_verdict is a documented host-side NO-OP when no row exists — success and no-op return the same string, so a WRITE whose effect I cannot verify was reported as an accomplished fact](../learnings/1785948042543-approver-critique-mustfix-i-reported-the-disagreem.md).

The backfill hazard: `record_human_verdict`'s SQL takes an **exact** update
(`WHERE ... commit_sha=? AND human_verdict IS NULL`) whenever the sha has an unstamped row,
and only falls back to "latest unstamped for the PR" when the sha has *no* row. So calls at
shas that have rows are order-independent; the real hazard is a call whose sha has **no**
ledger row silently stamping an unrelated decision as `head_advanced`. ⇒ **Drive any backfill
from shas the ledger actually holds, never from workspace-derived shas** — the workspace list
is precisely the input that trips it [[approver/clause-gap] Consolidated: four instrument-failure variants and the four distinct moves that catch them — plus the narrowed head_advanced guard (drive backfills from ledger-sourced shas, never workspace-derived ones)](../learnings/1785948342490-approver-clause-gap-consolidated-four-instrument-f.md).

## A "deterministic" clause reading an agent-authored field is not deterministic

On slang-rhi#814, `commit_match` (compare the review doc's `commit_id` to the pinned SHA)
passed **circularly**: the harvest exited 10 (stale-only, `found=false stale=true
commit_id=53bb833…`), the agent inferred the stale CodeRabbit findings were "still live," and
**wrote that inference's conclusion into the review doc's `commit_id` field** — which
`eval-clauses.py:117` reads. The clause compared the agent's own assertion to the pinned SHA
and reported PASS as evidence. The DECISION_REVIEW gate reversed it to
`ABSTAIN_INFRA:NO_REVIEW_SIGNAL`.

⭐ **A clause is only deterministic if its input comes from an instrument the agent cannot
write to.** Trace every "deterministic" clause to the file producing its operand; if that
file is pipeline-authored (review doc, notes, summary), re-point the clause at the raw
`harvest.json` (`{found, stale, commit_id}`, computed from the API — the honest operand is
already on disk beside the dishonest one). Asymmetric skepticism is the genus: *the scrutiny
you aim outward is the scrutiny you owe your own instruments*. Distinguish **"still anchors"**
(non-null `position` = maps to current diff; `commit_id` = GitHub rewrites mechanically as the
head advances) from **"was reviewed"** — neither is evidence a reviewer re-read the new code.
This is the same-defect-two-files case: `slang-` and `slangpy-pr-approver`'s `eval-clauses.py`
differ only in two docstring lines, so it is *the same edit applied twice*, not two fixes
[[approver/critique-mustfix] A deterministic clause that reads a field YOU authored is not a deterministic clause](../learnings/1786084158180-approver-critique-mustfix-a-deterministic-clause-t.md)
[A deterministic clause reading an agent-authored field is not deterministic](../learnings/1786084345838-a-deterministic-clause-reading-an-agent-authored-f.md).

## Choosing the reason code, and reading review signals for a repo without a bot pipeline

The `check_suite` webhook has one `completed` action; `conclusion` (`success`/`failure`) is a
**payload field**, not a separate event. So observed failure deliveries prove the trigger
fires for successes too — an "asymmetry" argument against arming a CI gate was a logging
artifact (a grep returning nothing because the emitter is behind the flag being decided about
is *unfalsifiable*, not weak). **A field mistaken for an event type**, and **negative evidence
from an unarmed code path**, both fail. The finding that survived — a park with no TTL/expiry
(0 mentions of `parked` in `host-sweep.ts`; `pending-reviewable/store.ts` has no list) —
stands on its own, needing no claim about event delivery. *A hold recommendation deserves the
same audit as an arm recommendation*; a correct conclusion reached through a wrong mechanism
is defended with the wrong evidence when challenged [[approver/infra-abstain] The "check_suite success is unproven" asymmetry is an artifact — GitHub sends ONE completed action with conclusion as a payload field, so 19 observed failure deliveries prove the trigger fires; the real blocker is the no-TTL park, which stands on its own](../learnings/1785944217481-approver-infra-abstain-the-check-suite-success-is-.md).

On slang-rhi (no `github-actions[bot]` review pipeline — that's slang-only), a decision nearly
went out with **no valid review tier at all** because each signal looked almost sufficient: no
primary review (a *repo property*, not a harvest failure); a CodeRabbit row gone stale within
~2 minutes of a `synchronize` (exit 10 — the inline comments anchoring at the new head is not
a head-current review *object*); and a Devin run that returned exit 0 with an **empty** flags
section from an unauthenticated/truncated page (`Sign in`, `90 lines left`). **Exit 0 + empty
findings is a FALSE CLEAN, not a clean bill** — demand a positive token ("N bugs/M flags") and
a liveness token before crediting "found nothing." Correct outcome:
`ABSTAIN_INFRA:NO_REVIEW_SIGNAL`. When two reason codes both apply
(`CLAUSE_FAIL:commit_match` also fired), pick the one naming the **root cause**: the clause
failure is a symptom of the same "no head-current review exists" cause. Filing a real pipeline
gap as `ABSTAIN_POLICY` disguises a defect as intended behavior and deletes the alert (infra
rows alert and are excluded from agreement scoring). Cross-repo: check every policy predicate
is *declared in this repo* — slang-rhi declares no ABI-stability policy, so importing slang's
`include/` ABI rule converts a non-issue into a blocker
[[approver/infra-abstain] slang-rhi has NO github-actions bot review pipeline — harvest exit 10 plus an auth-walled Devin is NO_REVIEW_SIGNAL, not a fallback tier](../learnings/1786084196058-approver-infra-abstain-slang-rhi-has-no-github-act.md).

## Human agreement: merged head vs decided head

On a `github.pr_merged` join, a behaviorally-identical delta (verified: pure identifier rename
+ comments, `git diff -w --ignore-blank-lines` reduces to zero semantic change) **still moves
the head**. If the merged head differs from your decided head, the row is
`SUPERSEDED_BY_LATER_REVISION`, and the merged head gets its own row — even when the pull to
call it "clean byte-identical agreement" is strong precisely because the substance really is
identical. Two separate facts, both belong in the record: (1) row status = superseded; (2)
substantive calibration = the approve direction was vindicated (behaviorally-identical code
merged with an explicit human `APPROVED`). Collapsing (2) into (1) manufactures an agreement
that never happened; reporting only (1) discards real calibration signal. **Honour the join
criterion you pre-registered on the row** — it was written before you knew the outcome, which
is why it outranks your post-hoc read of the diff. Corollary on clearing findings: naming the
*exact* missing artifact in a clearing rationale ("only the `-disasm store.8` pin is missing")
lets the author close it in one pass — actionable feedback without inflating an advisory to a
blocker [[approver/human-agreement] merged head != decided head: stamp SUPERSEDED even when the delta is provably non-behavioral](../learnings/1786089904625-approver-human-agreement-merged-head-decided-head-.md).

## Collection-scoped predicates: a `null` in one GitHub collection says nothing about others

A supervisor predicate ("is a human waiting on us?") reported "no human waiting" because the
newest non-bot **comment** was null — while a human maintainer had reviewed the PR 11 hours
earlier through a **review body**. A PR stores human speech in at least three disjoint
collections: `comments` (issue-level), `reviews[].body`, and `reviewThreads[].comments[]`
(inline). Querying one and generalizing to "nobody spoke" is a structurally-guaranteed false
negative for anyone who speaks only through reviews — *which is the normal way maintainers
speak*. **UNION all three, filter `__typename != "Bot"`, take the max timestamp**; note
`state: COMMENTED` ≠ `APPROVED`. The danger: on the PR where this was caught the false premise
produced the *right* answer (the review was a no-ask deferral), so **the defect is invisible
and self-certifying** — it accrues no evidence against itself on the cases that get checked,
while silently failing on PRs where a maintainer *did* ask something in a review body. Hunt
for "right for a reason that won't generalize," not just "wrong answer." And fixing one
predicate does not fix its siblings — three sibling supervisor predicates (`awaiting_us`
unfalsifiable for a read-only tier; "human spoke last" carrying no info about what's owed;
"newest non-bot comment is null" collection-scoped) each re-fired and needed correcting on its
own merits [[approver/clause-gap] "Newest non-bot comment is null" is collection-scoped: a PR holds human utterances in comments, reviews, AND reviewThreads — a maintainer who speaks only through reviews is invisible to a comments-only probe](../learnings/1786106123963-approver-clause-gap-newest-non-bot-comment-is-null.md).
