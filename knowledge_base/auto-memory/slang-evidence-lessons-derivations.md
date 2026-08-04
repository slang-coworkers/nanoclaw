---
name: slang-evidence-lessons-derivations
description: Long-form derivations for the evidence & verification standing lessons — split out of MEMORY.md to keep the index under the Read limit. Conclusions live in the index; the PROOFS live here.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

# Evidence & verification lessons — the derivations

Split out of `MEMORY.md` 2026-08-03 (index hit 21.3KB against a 24.4KB Read limit). The index keeps
**conclusions + do-not-reintroduce markers**; this file keeps the **evidence that makes them
believable**. Per the split checklist: text below arrived here by a content move, was current at the
time of the move, and is unabridged except where noted.

⚠️ **Read this file before restating any of these lessons to a coworker or upstream.** A maxim
without its proof gets tidied away by the next reader — that is the exact failure mode several of
these lessons document.

---

## 1. `#if 0` chains, `#elif`, and correcting with a broken instrument (slang#12331, 2026-08-03)

Full chain context: [[project_12331_spirv_opt_size_preset_Os]].

I told the triager its "dead `#else`" reading was inverted. **My correction was itself wrong**, and
the tool I recommended is what produced my error.

Ground truth @ `d9353c090`, `source/slang-glslang/slang-glslang.cpp`, inside
`case SLANG_OPTIMIZATION_LEVEL_DEFAULT`:

```
#if 0    :335   DEAD   —  7 RegisterPass  ("previous 'default optimization' passes … for glslang")
#elif 1  :344   LIVE   — 14 RegisterPass  ← ships as -O1
#else    :384   DEAD   — 18 active + 15 commented-out (RegisterSizePasses-derived tuning log)
#endif   :447
```

The two greps side by side:

```bash
grep -n '^#if\|^#else\|^#endif'          # → 335, 384, 447        ⇒ "#else is live"  ✗ WRONG
grep -nE '^[[:space:]]*#[[:space:]]*(if|ifdef|ifndef|elif|else|endif)'   # → 335,344,384,447  ✓
printf 'BEGIN\n#if 0\nA\n#elif 1\nB\n#else\nC\n#endif\nEND\n' | cc -E -P -   # → BEGIN B END
```

- **First arm whose condition is true wins; every other arm is dead.** With `#if 0` / `#elif 1`,
  the `#else` is unreachable.
- My "21 calls in :336-383" was an artifact of **merging two arms across an invisible seam** (dead 7
  + live 14). A count that spans a boundary you cannot see looks like corroboration.
- **When you correct someone on X, re-derive with a DIFFERENT INSTRUMENT** — not a better-run version
  of theirs. A correction built on the same broken tool reproduces the error *with more confidence*,
  and confidence is what gets it propagated: mine went into shared learnings with
  do-not-reintroduce markers **pointing the wrong way**.
- ⭐ **Both readings missed the actual finding, and it was in the live arm's own comment.** `:352-353`:
  the `#else` passes give *"smaller SPIR-V fairly quickly"* but *"can cause serious problem on some
  drivers"*; `:355-356`: *"less than half size of the previous -O1 passes."* The list was rejected
  **deliberately, over driver compatibility** — not size, speed, or rot. Arguing "which arm?"
  crowded out "why?", for two tiers in a row.
- ⭐ **The ENABLING CONDITION was an underspecified claim, not just my broken tool** (triager's own
  post-mortem, and the honest half of the account). Its original wording — the arm is *"disabled"* —
  was **right about the fact but silent on the reason**. A claim that asserts a status without its
  cause is contestable **in both directions**: nothing in it can refute a confident wrong
  correction, so my inversion met no resistance. ⇒ **state the status AND the mechanism** ("dead
  because `#if 0`/`#elif 1` selects the second arm; rejected there over driver breakage per
  :352-353"). The unfalsifiable-by-construction claim is what let two rounds pass with the
  load-bearing fact unread one screen away. Corollary: when someone's claim feels contestable, the
  productive move is to **ask what would make it precise**, not to assert its opposite.

---

## 2. NARROWING ≠ TESTING the premise (rhi#800/#801)

Index conclusion: [[feedback_narrowing_is_not_testing_check_own_store]].

⛔ **DO NOT COMPRESS THE EVIDENCE — preserved verbatim from the index entry:**

> rhi#800/#801: asserted→narrowed→**fully inverted**; narrowing inherits the untested premise and
> launders it as diligence · answer was already in my notes ⇒ **recall, not evidence, failure** (grep
> own store for stable env properties) · ⭐⭐⭐my store was **UNEXECUTABLE** (0 hits) ⇒ run any
> "always check X" as a stranger; deliverable = the **INDEX ENTRY**, not the rule · absence-of-log-line
> ≠ evidence · agreement on an untested premise ≠ corroboration ⛔**DO NOT COMPRESS THE EVIDENCE: both
> tiers held only the narrow half and found it in the SAME TURN, neither catching their own — that
> mutual-simultaneous failure IS the proof, and a maxim without it gets tidied away by the next reader.**

---

## 3. A correction appended ≠ applied — the sweep classes

Index conclusions: [[feedback_correction_must_sweep_whole_file]] +
[[feedback_sweep_rule_case_study_rhi800]] (18-error case study).

5 classes; **carry-through is the largest** and is invisible without the POSITIVE half of the sweep.

- ⭐ The verifier is subject to its own class (confirm zeros against **RAW TEXT**).
- ⭐ A conceded correction can be **installed as its own opposite** in the surface you rewrote most
  recently.
- ⭐ A hoisted block can **evict its own** imperative — track headroom; the fix documenting a broken
  grep cost 1.2KB.
- ⭐ **DIAGNOSING ≠ LOCALIZING** — a confident diagnosis carries no address; grep your own store
  before attributing a defect elsewhere.
- ⭐ Mis-addressed correction ⇒ **accept the lesson, decline the work item, separately**.
- ⭐ **A SPLIT is a content move — moved text arrives UNMARKED.** Split checklist = size · links ·
  positive content · **staleness of relocated text**.
- ⭐ A controlling block carries **conclusions + do-not-reintroduce markers ONLY**; derivations go to
  a child, else it grows unbounded (every correction adds a layer, none deletable).
- Grep the **superseded** wording — a search for your fix cannot match stale text. #800 = **7
  surfaces** still taught the retracted version.
- **`/workspace/shared/` is Main-write-only ⇒ stale shared prose is MY repair, not an ack** — but
  NOT via `learnings/INDEX.md`, which is regenerated
  ([[feedback_shared_index_is_generated_use_shared_root]]).

---

## 3b. FORWARD REFERENCE — a pointer to a child that PREDATES the claim

Found by slang-ci-babysitter, 2026-08-03. **2 instances in my own index within the hour**, both in
hooks I had just authored. Belongs to the sweep classes in §3.

**The mechanism:** I write an index line whose hook summarizes a claim, and point it at a child that
does not contain that claim yet. Nothing was ever deleted, so:

- **cut-then-verify never fires** — there is no removal to audit.
- **a link check is all-green** — the target file exists; only its *content* is missing.
- ⇒ **"I only shortened, I didn't delete" is FALSE reassurance.** The two failure modes are
  independent: shortening risks losing content, *writing* a pointer risks it never having been there.

✅ **Content-grep the child when you WRITE a pointer, not only when you shorten one.**
`grep -ciF '<the distinctive phrase from the hook>' <child>` — plus a non-zero control
([[feedback_audit_grep_false_negatives_asymmetric]], whose escalation ladder catches the case where
the content IS present but under different wording — that happened here for "adjacent rationale
comment", present at §1 as "the live arm's own comment"/`:352-353`).

⭐ **A rewrite can feel like compression because it reads CLEANER.** Measured on this very file:
my 1st "shortening" came out **+476 bytes**, the 2nd **+255**, the 3rd finally **−190**.

✅ **Print a before/after delta on THAT LINE**, not the file total:

```bash
OLD=$(awk 'NR==<n>' file | wc -c); printf '%s' "$NEW" | wc -c   # compare the two
```

The file total is the **wrong instrument** when anything else writes concurrently — a linter masked
the growth twice, so the total went *up* after edits that I believed removed text. Same class as
[[project_critique_gate_pulls_pattern_builtin_floor]]: an instrument inside the phenomenon.

---

## 4. Unattributed fact reads as your own — all three forms

Index conclusion: [[feedback_unattributed_fact_reads_as_your_own]].

No reader-relative provenance; aggregates kill provenance; sameness across trees ≠ common cause.

- ⭐⭐ **3rd FORM — RELAYING A COWORKER'S NUMBER UPWARD LAUNDERS IT INTO FACT.** I put the
  babysitter's `6000/6000` into an **operator escalation** unprobed. One `gh api -i` settled it: the
  header limit IS 6000 (their number **REAL** ⇒ the triager's "misread error body" hypothesis
  **REFUTED**), but exhaustion was **transient, not ongoing** (my "is now causing" **overstated**).
  ⇒ probe your own edge before escalating; **a challenge is not a reason to adopt it** — refuting the
  challenger is as much my job; **tense carries a claim**.
- ⭐ **MIRROR IMAGE: DECLINE CREDIT YOU DIDN'T EARN.** The approver thanked me for 2 corrections I
  never sent (its own self-corrections that landed in my row via linter writes). Accepting is
  *harder to resist* (disclaiming looks worse) and corrupts the audit trail identically. **Grep your
  own outbound record, not your memory**; verify the substance anyway, then report "facts
  mine-verified, authorship theirs."
- **N registered, M executed** always paired (209 rows / 207 SKIPPED / **0 executed**); a broader
  control grep must be non-zero before you believe any zero; **never cite log print order as emission
  order when logging buffers**.
- ["Recorded" is unauditable across tiers](feedback_recorded_is_unfalsifiable_across_tiers.md) —
  durability = GitHub comment / ledger row; say "local notes".

---

## 5. A wrong premise supporting a right conclusion (#11225, rhi#797)

Index conclusion: [[project_11225_capability_target_incompat_slangpy_break]].

A WRONG premise supporting a RIGHT conclusion is the hardest error to catch; distrust "structurally
cannot" in my own output, especially when correcting someone.

⭐ **2nd instance, rhi#797: "CPU-signalled fence" was FALSE** — `m_d3dQueue->Signal` is
`ID3D12CommandQueue::Signal` (GPU timeline); a CPU signal would be `fence->Signal`. Yet the nit-class
verdict it supported was RIGHT, so nothing prompted a re-check and it got recorded as the
*strengthened* basis. **A severity DOWNGRADE resting on API timeline semantics ⇒ verify receiver +
signature of the exact method, not merely that the call site exists.**
Audit: [[project_approver_endpoint_split_harvest_audit]].

---

## 6. Squash merge, ancestry, and blocked verification (rhi#805/#806)

Index conclusion: [[feedback_squash_merge_breaks_merge_base_ancestor_check]].

- ⭐ SQUASH merge ⇒ `merge-base --is-ancestor` returns NON-ZERO even though the fix landed. Arbiter =
  merged file **content** + parent count (1 = squash), never the graph.
- **Closure is EVENTUALLY CONSISTENT with the merge** (~1-sec `merged_at`→`closed_at`) ⇒ re-read
  state before acting on a "`Closes #N` didn't fire" claim, else you human-gate-close an
  ALREADY-closed issue.
- ⚠️ **That race did NOT cause #805.** The fixer's issue-state command was **gate-DENIED and never
  ran**; its git-only fallback is **CAPABILITY-MISMATCHED** (git cannot see issue state); it asserted
  from an ~8h-old value.
- ⭐⭐ **A blocked verification call ⇒ UNKNOWN, not UNCHANGED.**
- ⭐⭐ I published the triager's **guessed, EXCULPATORY** cause as fact ⇒ **attribute causes only to
  whoever could OBSERVE them**. A charitable story needs MORE evidence, not less — it draws less
  scrutiny.
- ⭐ **A learning inherits the unverified premises of the report it was filed from ⇒ file at the
  granularity of what was VERIFIED.**

## 3c. A hook/child MISMATCH does not say WHICH SIDE is wrong
Found by slang-ci-babysitter 2026-08-03, and it inverts §3b's three instances.

Its index said *"coreDebugBridge — #11817 MERGED 06-30"*; the child still read
*"evictions stop once #11817 lands"*. **Here the HOOK was right and the CHILD was
stale** — the opposite of every prior case, where the child was missing content the
hook asserted.

⛔ **Consequence for any automation: an auto-repair that always appends index→child
(the natural generalization from §3b) would have overwritten a correct hook with a
stale child's claim and re-opened a bucket that merged five weeks earlier.**

✅ **Rule: resolve against GROUND TRUTH, never against whichever of your own texts you
wrote more recently.** A disagreement between two of my own artifacts is not evidence
about which to trust — it is the relayed-premise rule pointed inward. Verified via
GitHub: `#11817 merged_at 2026-06-30T01:32:53Z`.

⭐ **The detector needs its own verification step.** That true hit surfaced as a bare
token `30` — a tokenizer split on the date `06-30` — indistinguishable from a false
positive, and nearly dismissed. Surprising-shape-in-either-direction applies to the
**tool** as much as to the measurement.

## 3d. A SELF-EXPIRING NOTE DOES NOT EXPIRE ITSELF
A memory whose own text says *"delete this when X lands"* keeps reading as **live**
after X lands, because nothing re-opens it. It is §3c's stale-child case with a
built-in trigger nobody pulls.

✅ **Sweep (ran 2026-08-03, my store):**
```bash
grep -rln 'expires when|once .* merges|once .* lands|delete this memory|retire this memory' *.md
```
→ **8 hits, 2 stale by ~26 days**, both resolved against GitHub rather than either text:

| memory | stated gate | ground truth | was reading |
|---|---|---|---|
| `project_11681_descriptorhandle_constantbuffer_mergeready` | "resolved only once **#11685** merges" | #11685 **merged 07-09T14:25:20Z**; #11681 closed `completed` 07-09 | LIVE |
| `project_11780_simplifyir_regression_pending` | "assist only if requested once **#11779** lands" | #11779 **merged 07-07T13:34:41Z**; #11780 closed `completed` 07-10 | LIVE |

Both now led by `GATE DISCHARGED` + the verified timestamps, history retained below.

⭐ **A stated expiry is a promise the file cannot keep** ⇒ schedule the sweep; don't
trust the note to announce its own obsolescence. Note the gate is often **not** the
issue the file is named for (#11681's gate was PR #11685) — resolve the *named
trigger*, not the filename.

## 3e. INHIBITORY gates fail toward INACTION — the worst stale-gate subclass
Named by slang-ci-babysitter 2026-08-03 after finding a **50-day-stale** instance.

Most stale notes **misinform**. An *inhibitory* one — *"do NOT act until X"* — keeps
**suppressing correct action** after X fires. Its failure mode is **inaction, which
leaves no trace**: nobody reports the requeue they didn't file, the PR they didn't
merge, the dispatch they withheld. Invisible to any check that inspects wrong *output*,
because there is no output. Sibling of the false-capability-negative (§ published
negatives): both are errors whose blast radius is un-observable in principle.

**Babysitter's instances** (all triggers resolved against GitHub): `project_11773…`
gate #11817 merged 06-30 (35d) · `project_11923…` gate #11923 merged 07-08 (26d) ·
`project_shader_coverage_msvc_break` gate **#11584 merged 06-13 (50d)** — the last
carried *"keep evicted PRs un-requeued until #11584 merges"* for an **all-platform
merge-queue-blocking break fixed seven weeks earlier.**

**My instance** — `project_11528_gapc_pending`: gate **slang-rhi#782** (cross-repo,
not the filename's number) merged `2026-06-29T16:33:40Z`; instruction was *"must NOT
merge slang#11792 until #782 lands AND the pin moves."*

⭐ **Two-step discharge, because step 1 alone misleads:**
1. **Resolve the NAMED TRIGGER** — not the filename. `project_11773`'s gate was
   #11817; mine was slang-rhi#782. Resolving the filename returns a true "merged" that
   is *confirmation-shaped* while answering a different question.
2. **Then ask whether the gated ARTIFACT still exists.** "Trigger fired" ≠ "condition
   live." slang#11792 is **closed, `merged: false`** ⇒ the condition is **moot**, so
   discharging correctly yields *no* follow-up work. Skipping step 2 manufactures
   phantom un-blocked work.

## 3f. Check INBOUND references before honoring a note's self-delete
A note saying *"delete this once merged"* may be **cited as evidence** elsewhere.
Babysitter declined its own `#11923` self-delete because
`feedback_sigb_eviction_nudge_gate.md` cites it as the evidence for the ~15h
auto-requeue window — deleting it would have left a dangling link.

⇒ **Mark discharged and keep; convert the datum from "pending watch" to "supporting
evidence."** This is §3b's forward-reference defect pointed the other way: an empty
child vs. a dangling pointer. **Grep for inbound `[[links]]` before deleting anything.**

## 3g. MODE 7 — reachable to the TEAM, invisible to the AGENT (cross-store)
Named by slang-fixer 2026-08-03 after the symmetry fired **in both directions in one
session**. Distinct from Modes 1–6, which are all *within* one store.

| rule | held by | absent from | consequence |
|---|---|---|---|
| *no `../` in `#include`* (jkwak, repo-wide; #12216 merged 07-25, 420 files) | slang-fixer's store (unindexed there) | **mine, entirely** — `include` was **0 hits** in my index | I had zero coverage of a standing directive with no CI guard |
| *never take state from a summarizing tool* | **`/workspace/shared/learnings/`** | **slang-fixer's store, at any depth** (`grep webfetch|prose-only|summariz` across 199 files → nothing) | the error fired **twice** identically (#12186, #12201), not once |

⭐⭐ **"The corpus knows" is not a property any individual agent can rely on.** A rule
can be well-recorded fleet-wide and unreachable by every agent who needs it — and the
shared store failing is the *worse* case, because its existence creates false assurance.

✅ **Operational consequence (fixer's, adopted): when a peer cites a rule you don't hold,
FILE AND INDEX IT IN YOUR OWN STORE — don't merely comply.** Compliance ends with the
message; the next fresh context has neither. And **don't assume the shared copy protects
your peers** — the direction that failed here is exactly the one where the shared store
*did* have it.

## 3h. A sweep's detector will eventually match the note DESCRIBING the detector
My final dead-link sweep reported **1 dead index link**: `](file.md)` — the literal inline
example inside my own note documenting the dead-link sweep. The detector matched its own
documentation.

⛔ **Confirming beats "fixing":** creating `file.md` would have been
**Mode-4-manufactured-by-repair** (§3b/§3e repair-side guard).

✅ **Two cures:**
1. **A not-a-link class in the triage before reporting any count** — mine also caught
   `[[LOAD]]`, `[[depth]]`, `[[links]]`; the fixer's caught `[[nodiscard]]`, `[[noreturn]]`,
   `[[deprecated]]`, `[[vertex]]` (C++ attributes and SPIR-V/HLSL tokens in prose). **A store
   documenting bracket-syntax languages has a built-in false-positive floor.**
2. **Write sweep documentation with placeholders that CANNOT resolve** — `<file>.md`, `$f`,
   `<memory-dir>` — never a plausible fake filename. The fixer's note escaped self-matching
   *by luck*, having used `<memory-dir>`; luck is not a cure.

⭐ **And the meta-instance: updating the modes note made its own index line stale** ("6 ways"
vs 7 sections) — Mode 6, self-inflicted, in the same pass. **A count in an index is a claim
that ages the moment you append.** Prefer no count to a stale one.

## 3i. My actual sweep results — a dead-link count is meaningless until TRIAGED

Run before compaction, per the rule that **Mode 4 inverts the compaction instruction**: where
an index line is the ONLY copy of a fact, "move detail to the child and shorten" *deletes* it.
(`slang-fixer` found **23 dead index links**, 22 genuinely absent, and was one edit away from
trimming 4 lessons into nothing.)

My result: **0 dead `](file.md)` index links**, and **49 dead `[[wiki-links]]` out of 1309**
across children. Triaged rather than counted:

| class | n | disposition |
|---|---|---|
| hyphen-vs-underscore **slug variants** (content existed, pointer wrong) | **17** | repaired |
| typo (`dead_promise` → `deadpromise`) | 1 | repaired |
| **superseded** — concept alive under another name (Mode 4) | 5 | repointed to `feedback_never_relay_a_verdict_not_in_hand` |
| truncated fragments | 10 | repaired |
| **cross-store** refs to `/workspace/shared/learnings/` slugs, not memory files | ~19 | verified resolvable ⇒ **NOT broken** (see §3g) |

⭐ **49 → 0 actionable, with zero content lost.** The raw count would have justified either a
panic or a mass "repair" that manufactured Mode 4 by deleting live pointers. **Triage classes
first, report a number second — and never act on an untriaged count.**
