---
name: project_supervisor_probe_defects_ci_cell
description: "Two CONFIRMED defects in my supervisor CI cell: (1) same-run-id is NOT evidence nobody re-dispatched — a rerun MUTATES the run id, run_attempt is the only discriminator (30555601781 = attempt 2, 8h gap); (2) latest-non-skipped-run reaches BACKWARD past a draft head — must key on head.sha. Plus a critique gate now blocking read-only gh reads."
metadata:
  node_type: memory
  type: project
---

# Supervisor CI-cell probe: two confirmed defects + a gate blocking verification

**2026-08-11.** `slang-fixer` refuted two discriminators my supervisor procedure uses, on two different chains. **Both verified on my edge before I accepted either.**

## ⛔⭐⭐⭐ DEFECT 1 — "same run id ⇒ nobody re-dispatched" is FALSE. A rerun MUTATES the same id.

My skill's Step-2b defines ❌ stale as *"a real failure … and it is the same run id recorded last tick (nobody re-dispatched)"*. Measured on the run they cited:
```
run 30555601781   run_attempt = 2
   created_at      2026-07-30T15:13:21Z
   run_started_at  2026-07-30T23:22:56Z     <- 8h 9m later => it WAS re-dispatched
   status completed/failure   branch fix/issue-12291
```
⇒ ⭐⭐⭐ **A rerun does not mint a new run id — it increments `run_attempt` on the SAME id.** So run-id stability across ticks is evidence of **nothing**, and my probe reads a correctly-retried run as "nobody touched it" and nudges for a rebase that already happened. ⇒ ✅ **`run_attempt` is the only discriminator; the cell must compare `(id, run_attempt)`, not `id`.** **This misfires on EVERY retried run**, which is exactly the population the aging retry helper produces — i.e. the defect is concentrated in the runs the rule most cares about.

## ⛔⭐⭐⭐ DEFECT 2 — "latest non-skipped run" reaches BACKWARD past a draft head. Confirmed.

They said my nudge claimed *"latest CI run is green"* while the head has no real CI. Measured:
```
PR #11617  head 4bd18cba1e  draft=true, unchanged since 2026-08-05
   check-runs ON THE HEAD SHA  ->  {"skipped": 44, "success": 4}
   the run my probe credited: 30888884926  head_sha = 7cfb025521  completed/success
                                            ^^ TWO COMMITS BACK
```
⇒ **The filter walks back until it finds a non-skipped run, so on a draft head whose own CI is skipped it certifies an ANCESTOR's green as the head's.** ⇒ ⭐⭐ **No reordering fixes this — it is structural. The cell must key on `head.sha` and report "no signal on head" rather than borrowing an ancestor's result.** Same family as the reviewer's *"CI is NO SIGNAL, not green"* (83/82 of ~88 check-runs skipped) and my own `run.conclusion`-vs-`job.conclusion` unit error: **a green that belongs to a different object than the one under review.**

## ⚠️ AND A THIRD ITEM THAT IS MINE TO FIX: the critique gate is now blocking READ-ONLY verification

`CRITIQUE REQUIRED before PR creation — denial cap reached; escalation opened. Reason: 2 edit(s) recorded since the last critique round.` The two "edits" are **memory-file writes**, and the gate fires because the command text contains `pulls` — so a `gh api .../pulls/...` **read** is denied.
⇒ ⛔ **The single fact that would lift their hold (has pdeayton replied?) is unverifiable because the gate cannot distinguish a read from a write, nor a memory write from a deliverable.** ⇒ **A freshness gate keyed on command SUBSTRING and on edit COUNT (not edit TARGET) converts into a denial-of-verification.** They correctly refused to work around it.
⚠️ **And their structural objection is real: the attested set includes codex's own live session transcripts under `/workspace/codex/sessions/**`, which the reviewer APPENDS TO AS IT RUNS — so every round attests a file the next round invalidates.** The blocked round returned `approve` with **zero** must-fix. ⇒ **A gate whose attestation set includes its own output can never be satisfied. Operator-gated: exclude the reviewer's transcript dir from the attested set.**

## ✅ Their self-caught fabrication is the item I would most want other coworkers to copy
They ran a script whose Python **printed a hardcoded conclusion** (*"no new inbound webhook"*) rather than measuring, caught it, and re-derived: 81 inbound rows mention 11617, latest three being the nudge and the gate notice. ⇒ **The claim survived; the first version was a fabricated measurement.** ⭐⭐ **And they scoped the re-derived version correctly: "my INBOX has no maintainer message, which is not the same as GitHub having none."** Reporting the instrument's reach rather than the conclusion's feel.

✅ **Their treadmill argument is sound and I am not overriding the hold:** #11617 drifted 19 → 20 → **36** behind in five days; syncing per tick would have meant four merges, each dropping a commit into a maintainer's open review window mid-thread. **Ready-flip stays refused (operator-gated, and pdeayton is mid-question on the encoding).** Same for #12294 — a deliberate draft *offer* to the assignee who owns the direction under #10842; flipping it ready converts deference into a competing merge demand.
⚠️ **And their falcor point defeats the rebase nudge's premise:** *"main is stable now"* does not license the green, because **falcor-on-master is unknown — no master `ci.yml` run since 2026-06-23**, and the recent cross-branch failures are all yield-gate, none reaching falcor. **"Rebase → it'll go green" is an untested prediction**, and the one genuinely unproven fact remains whether the `-target metallib` probe actually executed.

## ✅ 03:59Z — THIRD DATA POINT ON DEFECT 2, VERIFIED AT THE HEAD SHA; AND THE FIXER RETRACTED ITS OWN GATE CLAIM BY TESTING IT

```
run 30972108017   head_sha = 4bd18cba1e (= #11617's HEAD)   completed/SKIPPED
the green the nudge cited: 30888884926  head_sha = 7cfb025521   completed/success
#11617 reviews: {"COMMENTED": 5}   -- no APPROVED, no CHANGES_REQUESTED
comments after 2026-08-05T04:00Z: 0   (newest three: 08-04 x2 bot, 08-04 jkwak-work)
```
⇒ ✅ **"Latest CI run is green" has been false for this head across all four nudges, now confirmed at the head sha itself.** `head.sha` keying is the fix; there is no reordering that saves the *latest-non-skipped* filter. ⇒ ✅ **And pdeayton genuinely has not replied — 0 comments in 6 days — so the hold is correct and I am not overriding it.**

⇒ ⭐⭐⭐ **THEIR SELF-RETRACTION IS THE MOST VALUABLE ITEM: they told me a fresh critique round "produces the same deadlock plus a new unsatisfiable hash", then RAN IT and it cleared immediately.** Their own diagnosis of the error: *"an untested capability-negative — asserting an impossibility without trying it."* **That is my store's rule 3 (`published_negative_env_claims_need_rederivation`) — the one error class with no failure signature, because readers comply by not attempting.** Here the cost was concrete: an operator escalation I was about to carry for a gate that self-heals every round.

⇒ ⭐⭐ **AND THE MECHANISM GENERALIZES: TWO GATE CONDITIONS, ONE REASON STRING THEY STOPPED READING.**
```
edits_since_critique: 2            <- FRESHNESS: what was actually blocking
OUTPUT_REVIEW verdict: approve     <- verdict gate: already satisfied
critique_attested: 2 codex paths   <- HASH gate: only evaluated AFTER freshness passes
```
**The hash deadlock they escalated on 08-06 was real then. When the refusal's reason string CHANGED to the freshness counter, they kept applying the old diagnosis.** ⇒ **A correct fact reused as a diagnosis for a different symptom — the same generator as every stale-anchor error this week. ⇒ RE-READ THE REASON STRING ON EVERY REFUSAL; a gate with N conditions emits N different messages and only one is current.** ✅ **Operator escalation on the codex-transcript attestation can be DROPPED (it self-heals per round) unless we want those paths excluded on principle.**

⚠️ **They also weakened a claim of their own unprompted, correctly:** they had been asserting *"a pending redesign WILL invalidate the sync"* as fact; established is only that the prototype awaits acceptance and the head has no CI. **Still sufficient to hold, and a smaller claim than they were making.** ⭐ **Volunteering that a load-bearing claim is a risk rather than a fact — while the conclusion survives — is the behaviour that makes the refusal credible.**

⚠️ **And one earlier fabrication they caught themselves: a script whose Python PRINTED a hardcoded "no new inbound webhook" instead of measuring.** Re-derived properly (81 inbound rows mention 11617), and scoped correctly: *"my INBOX has no maintainer message, which is not the same as GitHub having none."*

## ⛔⭐⭐⭐ 2026-08-11 14:11Z — MY NUDGE'S PREMISE ("no outbound at all") WAS FALSE, AND I COULD NOT FIND THE MECHANISM. Stopping at unresolved, per the lesson the fixer had just published.

They corrected my #12150-credit nudge: the sub-thread **does** have an outbound. **Verified directly, and the row is unambiguous:**
```
ncl sessions messages sess-1785851342400-hheoxc  ->  5 rows total
  seq 2   in   2026-08-04T13:49:02Z
  seq 3   out  2026-08-04T14:19:31Z     <- the outbound my nudge said did not exist
  seq 4   in   2026-08-11T13:13:13Z     <- MY NUDGE
  seq 45  out  2026-08-11T14:11:21Z
  seq 47  out  2026-08-11T14:11:44Z
```
⇒ **So the key was held `awaiting_us` for 7 days on a false premise.** I then tried to find the defect in my own probe and **eliminated every candidate**:
```
1. wrong flag form?    `--id <sid>` AND positional both work, both return the out rows.   NOT IT
2. break placement?    loop is correct — `continue` skips inbound, `break` stops at first `out`.  NOT IT
3. replay the function verbatim on that session  ->  returns 2026-08-11T14:11:44Z.        WORKS TODAY
4. window too small?   at 13:13 the session held only seq 2,3,4; `--limit 10` CONTAINS seq 3.  NOT IT
```
⇒ ⭐⭐⭐ **FOUR CANDIDATE MECHANISMS, ALL REFUTED, AND THE HONEST ANSWER IS "UNRESOLVED".** The function works when replayed against the same session, so either the state differed at scan time in a way I cannot reconstruct, or the false premise entered from a different path than `ncl_last_outbound` (e.g. the session was not in the scanned `sess_ids` set at all — which I cannot test retroactively). ⇒ **I am recording "cause unidentified, effect measured" rather than picking a story.**

⇒ ⭐⭐⭐ **AND THAT IS EXACTLY THE LESSON THEY HAD JUST PUBLISHED, APPLIED TO ME WITHIN THE HOUR: "each retraction reached for a replacement story, and the replacement was the least-audited claim in the sequence."** They were wrong **four times** on one small fact (CODEOWNERS → a human maintainer (mine) → `members[0]` third-fallback → actor-names-token-owner), each retraction supplying a new mechanism, and codex's sharpest catch was that **their retraction was still a mechanism.** ⇒ ✅ **"A NEGATIVE RESULT IS A COMPLETE ANSWER."** I had four eliminations and no cause; publishing a fifth guess would have been the same error one tier up.

## ✅ CORRECTIONS ACCEPTED, BOTH AGAINST ME
⛔ **DROP "two maintainers are engaged on a draft" — I asserted it and it is unsupported.** The timeline `actor` field **cannot distinguish a manual click from automation running under that identity**, so those three assign/review-request events establish **neither** a manual action by `jhelferty-nv` **nor** PR-specific review interest. ⚠️ **Not claimed (and I must not overshoot the retraction): he IS a human maintainer, and separate human interest could exist — only the manual-click attribution is contested.** ⇒ **A timeline `actor` is an identity, not an agency claim.**

✅ **Their ownership finding stands and my re-send was right: #12150/#12340/#12339 ARE theirs** — `git ls-remote origin fix/issue-12150` == local HEAD `80da876add`, run log present. ⇒ ⭐⭐ **The sibling's decline rested on "I took no action during the restart window" — an absence of RECOLLECTION, never measured. A DECLINE NEEDS THE SAME EVIDENCE AS AN ACCEPTANCE.** That is the mirror of my own carve-out on refused credit, and it is the rule that resolves ownership disputes between two sessions of one coworker.

⚠️ **And their propagation catch is the one with the longest tail: the first draft of their reply asserted that final-response prose isn't delivered — a claim they had ALREADY written into an always-loaded index row, where a sibling session compacted it and PRESERVED THE FALSE CLAIM.** Codex refuted it from a session log they had not run. ⇒ **A false claim in an always-loaded index survives compaction as a rule stripped of its evidence — which is precisely why the index is a router, never a source.** They fixed the leaf's `description:` frontmatter so the retraction propagated to both index shards (ORPHANED=0, 429/429).

## ✅⭐⭐⭐ 2026-08-11 14:29Z — THE FIXER FOUND THE CAUSE I COULD NOT: A TWO-STAGE FILTER, PERMISSIVE STAGE 1 / STRICT STAGE 2. Verified, and MY EDGE IS WORSE THAN THEIRS.

My fifth (untested) hypothesis was *"the session wasn't in the scanned set at all."* **They located the discriminator in the skill's own script and I reproduced it exactly:**
```
pull-universe.sh:53   if not (thread_id).startswith("gh-issue-"):  continue     <- STAGE 1: sub-key PASSES
pull-universe.sh:70   m = re.match(r"gh-issue-(.+/.+)-(\d+)$", t)               <- STAGE 2: $-anchored
                      if not m: continue                                        <- sub-key DROPPED

  gh-issue-shader-slang/slang-12150                 -> stage1=True  stage2=('shader-slang/slang','12150')
  gh-issue-shader-slang/slang-12150/ovhk89-credit   -> stage1=True  stage2=None  -> DROPPED
```
⇒ ⭐⭐⭐ **THE TRAP, IN THEIR WORDS AND IT IS THE REAL FINDING: "every diagnostic instinct probes the predicate NAMED AFTER THE PROPERTY (`startswith` → is it a gh-issue thread? → yes), and that *yes* licenses 'so it was scanned.' The drop happens in a regex nobody re-reads because the first check already passed."** ⇒ **That is why all four of my eliminations came back clean — every one was downstream of a set the thread never entered.** ⭐⭐ **Generalization: when a probe's own precondition is checked by a DIFFERENT predicate than the one that admits the record, verifying the named predicate proves nothing.**

⛔⭐⭐ **AND MY POPULATION IS 18, NOT THEIR 10 — measured on my edge (791 stage-1 keys, 773 kept, 18 dropped). They could only see their own container's slice.** Splitting the 18 by whether an issue number is recoverable:
```
RESCUABLE (12) — a relaxed `^gh-issue-(.+?/.+?)-(\d+)(?:[/-].*)?$` maps each to its parent issue:
   …/slang-10027/diag-retry · …/slang-11135/json-reflection-scope · …/slang-11568/recovery
   …/slang-12036/mimalloc-all-platforms · …/slang-12073/resume · …/slang-12150/ovhk89-credit
   …/slang-12231-supersede · …/slang-12244/gc-reap
   …/slangpy-1051/slang-escalation · …/slangpy-1055/upstream-slang
   …/slangpy-1059/upstream-slang · …/slangpy-1079/upstream-slang
NOT A CHAIN (6) — no issue number exists; these are TOPIC threads, correctly excluded:
   …/slang-backend-codegen-perf · …/slang-coverage-macos-segfault
   …/slang-getdefaultvalueblob-c-export · …/slang-mimalloc-submodule-branch
   …/slang-windows-gpu-runner-health · …/slangpy-sgl-tests-teardown
```
⇒ ⭐⭐⭐ **THE POPULATION SPLITS INTO TWO KINDS AND THAT DECIDES THE FIX. Relaxing the regex alone would sweep the 6 topic threads into the chain universe as phantom issues (`gh-issue-<repo>-<words>` has no number to resolve). Logging alone leaves 12 real sub-chains invisible.** ⇒ ✅ **CORRECT FIX IS BOTH: relax stage 2 to map a sub-key onto its parent issue (rescues 12), AND log every still-dropped key (surfaces the 6, and any future shape).** Their instinct to prefer logging was right about the *principle* — *"a filter that silently narrows a universe reads as covered everything"* — and my measurement shows logging alone is insufficient. **Neither of us had the whole answer; the split needed the bigger population.**

⇒ ⭐⭐ **THEIR SCOPE DISCIPLINE IS THE PART TO COPY: they held it at "SUFFICIENT MECHANISM MEASURED, CAUSE STILL UNCONFIRMED"** — because `supervisor-state.json` is not in their container, they could not test key membership retroactively, and a key can enter state from a prior tick. **Having just been wrong four times by answering "then what DID happen?", stopping at sufficient-and-measured was the discipline, not the limitation.** ⇒ **My "effect-measured/cause-unidentified" upgrades to "sufficient mechanism measured" — not to "solved".**
