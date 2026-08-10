---
name: technique_keeping_this_store_reachable
description: "How to keep this two-store memory readable: run reindex.sh (families + size-packed shards + orphan audit). The metric is ORPHANS-FROM-THE-READABLE-PREFIX, never file size. Covers the 4 defects measured 2026-08-05 — over-bound indexes, the append write path, equal-row-count sharding, and a second store reachable only via a prose-mentioned index."
metadata:
  node_type: memory
  type: technique
  originSessionId: 9872-scrub-redrive
---

# Keeping this store reachable — the procedure and the four defects behind it

⛔⭐⭐⭐ **THE ORPHAN METRIC IS NECESSARY AND NOT SUFFICIENT — IT IS BINARY, AND THE OPERATIONAL METRIC
IS *DEPTH*.** (08-06, derived with `slang-triager` after we each failed on the *same rule* in different
ways.) `reindex.sh` answers *"is it reachable?"* Two failures that night both **passed** that test and
still cost real work:

| my store | the peer's store |
|---|---|
| leaf existed, **`MEMORY.md` never linked it** (`grep -c` → 0) ⇒ **DARK** | `MEMORY.md → index-feedback → leaf` intact ⇒ **reachable but 2 HOPS DEEP** |
| I re-derived the rule and got it **wrong** — blamed a peer's config, spent operator attention on a no-op fix | It held **four** leaves on the rule and violated it **all evening** |

⇒ ⭐⭐⭐ **Both fail identically in practice: findable in an audit, absent when acting.** So the question
is not *"is it present?"* but **"at what depth — and does that depth survive a live exchange?"**
**A rule needing two lookups mid-exchange is a rule you will REDISCOVER instead of APPLY.**

⇒ **Hoist any rule that governs the mechanics of acting — message delivery, dispatch, posting authority,
edit-vs-fresh — into the READABLE PREFIX of `MEMORY.md`, not merely into a family index.** Reference
material (chain state, one-off measurements) can sit two hops down; *behavioural* rules cannot. Measured
fix: the delivery rule now sits **101 chars in** on my side, 2,816 on the peer's — both load every
session.

⚠️ **Corollary — a DARK rule is worse than a MISSING one.** Missing leaves a gap someone may close; dark
means you build a **confident rival theory on its territory** (I diagnosed a harness-contract defect as a
peer *instructions* defect and routed a no-op fix upstream). Cf.
[[feedback_zero_output_is_not_available_scratchpad_still_delivers]] — the leaf that was dark, and which
already described the exact 10-round loop I then re-lived.

**One command.** `bash /home/node/.claude/projects/-workspace-agent/memory/reindex.sh`
(add `--check` for a read-only audit; nonzero exit if any leaf is orphaned).
It regenerates every family index, re-packs the oversized ones into size-balanced shards, and then
verifies. ⭐⭐⭐ **The metric is ORPHANS-FROM-THE-READABLE-PREFIX, never file size** — a 4 KB index with
one dark link is worse than an 18 KB one with none.

State when this was written: **store A 732/732 reachable, 0 orphaned; store B 60 reachable, 16 residual
(all named scratch, 0 memory-bearing).**

## ⛔⭐⭐⭐ 2026-08-09 — MY GATES CANNOT SEE A DANGLING INDEX ROW, AND THE "FORWARD-REFERENCE BY POLICY" NOTE IS WHAT HIDES IT

A peer ran my own suggested probe on their store and found their gate structurally blind to index/leaf divergence. **So I ran it against mine rather than reasoning about it — and the case-sensitivity bug they found is absent here, but a worse gap is live.**

**Planted, both with UPPERCASE filenames** (their defect was a lowercase-only row regex):
```
plant 1: leaf on disk + row in a SHARD only  ->  SHARD-ONLY=1 ['_CTL_UpperCase_Probe']  rc=1   ✅ FIRES
plant 2: row in a shard with NO FILE         ->  SHARD-ONLY=2 [...]                            ⚠️ fires only as shard-only
```
✅ My regexes are `[A-Za-z0-9]`-class (`bin/check-integrity.sh:23,26,49`), so **case-blindness is measured-absent, not assumed-absent.**

⛔ **BUT: a row in the AUTHORED ROLLUP pointing at a file that does not exist is reported ONLY as a "DEAD wikilink", under the banner `NOTE: dead wikilinks are forward-references by policy; they mark lessons worth writing.`** That policy is correct for prose `[[links]]` in a leaf body — and **it swallows the one case where a missing target is a defect: an INDEX ROW.** `reindex.sh --check` measures the other direction only (`leaves=1077 reachable=1077 ORPHANED=0`), so **nothing in my apparatus distinguishes "index row whose leaf was deleted" from "aspirational link to a lesson not yet written."** Current dead-link count is **47** — a real dangling row would land in that pile and read as intentional.

⇒ ⭐⭐⭐ **A POLICY THAT LEGITIMIZES A CLASS OF FAILURE MAKES ITS GATE UNABLE TO REPORT THAT CLASS.** The "forward references are fine" rule is load-bearing and right; encoding it as *"dead links are never errors"* is what blinds the check. **Fix: split the predicate by SITE — dead link in a leaf body = forward reference (note); dead link in an `- [[…]] —` index row = ERROR.** Same shape as the peer's finding one level up: they excluded `MEMORY.md` from `collect()`; I included it and then excused its failures.

### ✅⛔ SAME DAY — I RAN THE STORE-WIDE DEAD-LINK CENSUS FOR THE FIRST TIME. MY HEADLINE "47" WAS WRONG IN BOTH DIRECTIONS.

A peer ran the census on their store after I raised the site-split, found ONE hit, and it was a **false positive** — `` `[[vk::binding]]` `` is Slang attribute syntax in an inline code span their stripper missed. ⇒ **Their gate over-reported by PARSING; mine under-reported by POLICY. One bucket serving two sites, in both cases.**

✅ **My new site-split gate is immune to their false-positive class, measured not assumed:** a backticked target *in an index row* fires (correct — a row is a row), while the same `` `[[vk::binding]]` `` *in prose* does **not** (`DANGLING = 0`). **The site split solves the parsing problem as a side effect, because prose is never scanned for rows.**

⛔⭐⭐⭐ **RETRACTED 3 MINUTES AFTER I WROTE IT — MY "2.6× UNDER-REPORTED" WAS THE POPULATION ERROR I WAS ACCUSING THE GATE OF.** I ran an unfiltered census (raw `[[…]]` regex), got 120 dead targets, compared it to the gate's banner of 47, and recorded a defect. **The gate was already right.** `bin/check-integrity.sh:27` filters `slug.match(t) and len(t)>8` *before* computing `dead`, so it deliberately excludes short prose words and non-slug code artifacts. Reconciled by applying its own filters to my population:
```
raw distinct [[targets]]      = 1227  ->  dead = 120   <- MY census
gate-filtered targets         = 1154  ->  dead =  47   <- the GATE, correct as designed
```
⇒ **47 and 120 measure different populations. Neither was wrong; my COMPARISON was.** ⭐⭐⭐ **I built a second instrument, got a different number, and concluded the FIRST instrument was broken — without checking whether the two were asking the same question.** That is the wrong-referent defect, at the level of the *population* rather than the *subject*, and it is the eighth instance in this session's chain. **A discrepancy between two instruments is a claim about neither until their domains are shown to match.**

✅ **What survives the retraction, and it is the part worth keeping:** the *split itself* is real and useful — of the gate's own 47, **40 are slug-shaped pointers** and **0 are renames**. And the census produced one finding no filtered count could: `[[…]]`-as-emphasis (`[[assume]]`, `[[nodiscard]]`, `[[x]]`) is a real habit of mine, invisible to the gate *precisely because* its `len>8` filter hides it. ⇒ **A filter that suppresses noise also suppresses evidence that the noise is being generated.**

⛔ **(superseded) the figures I recorded as a gate defect:**
```
my banner said            DEAD wikilinks = 47
actual distinct targets                  = 120     (2.6x under-reported)
  of which fence/code-span artifacts     =  65     never a real link
  genuine dead links                     =  55 distinct / 283 occurrences
    slug-shaped (real pointers)          = 136 occurrences / 63 distinct
    NOT slug-shaped (prose emphasis)     = 147 occurrences   <- [[assume]], [[nodiscard]], [[x]], [[foo]]
```
⇒ ⭐⭐⭐ **MORE THAN HALF OF MY "DEAD LINKS" ARE `[[…]]` USED AS EMPHASIS OR CODE, NOT AS POINTERS AT ALL.** I have been writing `[[assume]]`, `[[nodiscard]]`, `[[vertex]]`, `[[x]]` as *markup*, and the checker counts every one as a lesson-worth-writing marker. **The forward-reference policy therefore doesn't just hide defects — it manufactures a phantom backlog.** A reader following that banner would look for 47 unwritten lessons; the real actionable set is at most 63 slug-shaped targets, and most of those are also emphasis.

✅ **The one genuinely reassuring result, and it needed the census to establish:** **ZERO** dead links are RENAMES — no target exists under a hyphen/underscore variant or an ≥0.86 near-match. So **no pointer in this store is broken by a rename**; every dead link is either markup or a never-written leaf. **That is a real clean finding, and before today it was an untested assumption sitting behind a wrong headline number.**

⇒ ⭐⭐ **THE GENERALIZATION: a count that mixes two populations under-reports the one you care about AND inflates the one you don't, simultaneously.** My `47` was neither the artifact count nor the pointer count. ⇒ **Before quoting a defect count, split it by whether each member is ACTIONABLE — and state the split, not the sum.** Same shape as `make buckets sum to the population`, now with me as the offender.

⚠️ **And their sharper half, which applies to my `snapshot-before-edit.sh` too: a STATEFUL gate cannot answer a STRUCTURAL question, and re-baselining launders the defect.** They measured it — a planted orphan printed `NEW FILE`, then after `save` the orphan was **invisible** with `VERDICT: CLEAN` while the leaf was unreachable. ⇒ **My preservation gate is a diff against my own baseline; it is NOT an index-consistency claim, and I must not read its CLEAN as one.** Same generator as *scoping launders a stale figure*.

✅ **Restoration verified by diff, not by re-running the gate:** `diff` against the pre-plant copy shows exactly the two control rows removed, nothing else; `rollup 511 = shards 511`, `ORPHANED=0`, `leaves=1077`.

⇒ ⭐⭐ **THE TRANSFERABLE PART: my three live catches this session were all ONE direction (shard-only rows from a concurrent writer). A record of real catches in direction A is not coverage of direction B** — I read three saves as evidence the apparatus worked, and the deliberate plant found the hole in ~2 minutes. **Deliberate planting beats an accidental catch record, even a good one.**

## Defect 1 — an index past the read bound drops its tail silently

`index-feedback` (81.6 KB / 253 rows) and `index-project` (111.4 KB / 433 rows) each exceeded the
~24,986-char prefix, so 187 + 330 rows were **dropped on load**: measured **515 of 729 leaves
unreachable**. Fixed by sharding, **zero rows deleted**, counts conserved.

⛔ **A size warning is not a deletion instruction.** The hook demanded ~90% removal; the defect was
**shape**. Restructuring fixed it with nothing lost. Never satisfy a byte target by deleting
load-bearing rows — see [[feedback_compaction_target_yields_to_load_bearing_content]].

## Defect 2 — the write path, not just the snapshot

The append-only regeneration recipe writes rows to `index-<fam>.md`, which is **past the bound**, so a
new row lands where nothing can read it. **Orphans regrew twice within 40 minutes** of the manual fix,
because sibling sessions write leaves into this store concurrently
(`feedback_a_correct_stored_fact_can_be_corrupted_in_the_retelling` @22:0x,
`feedback_a_retraction_must_enumerate_publication_sites` @22:37).

### ⛔ Corollary measured 2026-08-05 21:53 — a concurrent store makes YOUR OWN COUNT a false alarm

Same concurrency, a new failure direction: not orphans regrowing, but **a healthy index reading as
catastrophically truncated.** I regenerated `index-project.md` and counted rows in the same command
chain — got **70** against a root index claiming 424. That reads exactly like *"I just clobbered 354
rows."* The recovery reflex is to rebuild from disk, i.e. **overwrite the file I thought I'd damaged.**

It was intact. Recounts seconds apart: **431 rows / 431 files → 432 / 432**, with `--check` reporting
**737 leaves, 737 reachable, 0 orphans.** The store was gaining files *while I measured it* (siblings
writing `project_7672_*`, `project_slangpy_821_*`, `project_slang_7672_*` at 21:54–21:56), and my
`70` was a read of a partially-written file mid-regeneration.

⛔**The dangerous part is that a false LOW count and real data loss are byte-identical**, and the
"remedy" for loss is destructive. Cf. [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]:
an instrument that silently measured the wrong state produces exactly the evidence that licenses a
harmful action.

⇒ ⭐⭐⭐ **Before acting on a count that implies loss, re-measure it — and compare against the FILES
ON DISK, not against a remembered figure.** `ls project_*.md | wc -l` vs `grep -c` in *separate*
commands, twice. Agreement across two reads means the number is real; disagreement means the store
is moving under you.
⭐⭐ **Never "restore" an index from a single alarming count.** Run `reindex.sh --check` (it asserts
row conservation and refuses on loss) and let the tool's verdict override your arithmetic.
⭐ **My reproduction attempt of the 70 in `/tmp` returned 431 — the bug was not in the recipe.** When
a repro fails to reproduce, the cause is environmental (here: concurrency), so stop blaming the
command and look at what else touches the file.

⭐⭐⭐ **Sharding fixes a snapshot; the write path has to be fixed too or orphans regrow silently.**
⭐⭐ **A fix that must be *remembered* by whichever session happens to write next is not a fix** — that
is why `reindex.sh` exists as a script. It is idempotent (two consecutive runs byte-identical),
asserts row conservation (refuses on loss), and its `--check` **has teeth: verified against a planted
orphan, which it caught.** A verifier nobody has seen fail is not known to work
([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]).

## Defect 3 — equal-row-count sharding is not equal-risk sharding

My first split used equal row counts. It looked fine and hid a countdown: shards ran
12,727→22,620 chars and **`index-project-5` had ~8 rows of headroom** — while alphabetical ordering
routes every new `project_12xxx` row into exactly that shard, and **91 project leaves were created
that day**. Repacked greedily by size (feedback 5→7 shards, project 7→9): **minimum headroom ~31 rows,
tail shards ~71-81.**

⭐⭐ **When row lengths vary ~10×, pack by bytes and keep ~40% headroom.**
⭐⭐⭐ **"0 orphans" is a SNAPSHOT; the durable question is WHERE THE NEXT WRITE LANDS.** An orphan
count of zero is fully compatible with being one write from failure — re-run the headroom check, not
just the orphan walk. (A peer independently confirmed the same trajectory on its edge: 82% of its
project rows named a current `11xxx`/`12xxx` issue, so growth concentrates rather than spreading
alphabetically.)

## Defect 4 — there are TWO stores, and a measurement of one says nothing about the other

- `~/.claude/projects/-workspace-agent/memory/` — the **live** store (732+ leaves, index `MEMORY.md`),
  loaded as Claude Code native auto-memory.
- `/workspace/agent/memory/` — the **OKF** store the SessionStart hook loads (77 files, index
  `index.md`). Holds **52 `legoop-*` operator facts that exist nowhere else**, plus the only copy of
  `project_11135_ir_type_alignment_attr_12306` (a maintainer-requested chain carrying a
  triple-verified 🔴 `addAttrs` interleaving bug).

A link-walk there reached **3 of 77** files, because that store's `MEMORY.md` was named in **backticks
three times and linked zero times**. ⇒ ⭐⭐⭐ **A filename in prose is invisible to every reachability
check; a backtick is not a link.** Fixed by linking it from `index.md`. Its 16 remaining unlinked files
are one-off scratch (A/B transcripts, board dumps, dated supervise snapshots) and are **listed in
`index.md` rather than linked**, because ⭐ **an unmeasured residual and an empty one look identical**.

⛔ **Never `cp` between these stores** — they are fully disjoint and differ in shape; a blind index
copy has clobbered an unread file before. Sync leaf notes if you must; never indexes.

## Instrument notes for anyone auditing this

- ⚠️ **Parse every notation class.** The root index uses `- [[wiki]]` rows **and** `| [[x]] |` table
  rows; topic indexes also use `](path.md)`. A single-notation parser silently misreports — a peer's
  `^- [text](path)` parser read **1 row in a 19 KB file**. ⭐ **A parser is a needle set too.**
- ⚠️ **Wikilink regexes pick up phantoms:** `[[noreturn]]`, `[[vertex]]`, `[[LOAD]]` are C++/HLSL
  attributes quoted inside memory files, not pointers. Intersecting with disk makes them harmless
  **only because no leaf bears such a name** — verified: 0 collisions, and all 732 leaves match a
  family prefix. A file literally named `noreturn.md` would be falsely marked reachable.
- ✅ **The unit is codepoints/1024**, not bytes:
  `python3 -c "import io;print(len(io.open('MEMORY.md',encoding='utf-8').read())/1024)"` matches the
  hook's figure to the decimal ([[feedback_the_memory_limit_unit_is_codepoints_over_1024]]).

## Defect 5 — the gate's own POPULATION (found inside the instrument built to prevent this)

A peer's freshly-written gate reported "0 problems" while a flat `glob('*.md')` excluded four
subdirectory files — **the same wrong-population defect the gate exists to catch, inside the gate,
within one message of writing it.** Patched to recursive, it then found **2 genuine orphans**, and
neither was scratch: `repro-slangpy-1059-cuda-swizzle/issue_body.md` is the filed body for
**shader-slang/slang#12073** (the CUDA/C-family emitter re-evaluates a swizzle base once per
component, tripling texture fetches for `.rgb` — the ~2.9× CUDA-vs-Vulkan gap in slangpy#1059, a
codegen defect rather than `float3` layout). ⛔ **A root-caused upstream defect and its downstream
cross-link were one directory level away from invisible.**

⭐⭐⭐ **A gate is only as good as its population: a 0 from a gate is still a measurement with a
scope.** Widen the population before trusting a green gate.

**My `reindex.sh` had the identical defect and was passing by luck** — `os.listdir('.')` is flat, and
flat == recursive == 757 here *only because all 265 subdirectories are `.git`*. Per
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] (a control that fires by luck is
not a control), it is now `os.walk` with `.git`/`node_modules` pruned, and a subdir file counts as
reachable under either its basename or its relative path.

✅ **Proven in both directions, which is the point** — the count was already 0 *before* the fix, so
reaching 0 proved nothing: planted `zzprobe/planted.md` in a **subdirectory** ⇒ the hardened gate
reports `ORPHAN: zzprobe/planted`, while the old flat listing provably could not see it (`'planted' in
flat` → `False`). ⭐⭐ **When you widen an instrument's scope, test the widening, not the total.**

Related: [[feedback_deference_drifts_to_whoever_corrected_you_last]] (the chain that produced this),
[[feedback_a_remedy_that_can_reproduce_its_own_bug]],
[[feedback_empty_frontmatter_makes_a_memory_unreachable]].

## ⭐⭐⭐ THE CHECKER'S BLIND SPOT IS THE STATE A NOTE ENTERS AT CLOSE (2026-08-06)

**Measured on my own tool, prompted by slang-triager hitting the same class in its checker.**

`reindex.sh` walks **six filename prefixes** (`reindex.sh:23`: `for fam in feedback project technique
reference command user`). Anything else is **invisible to `--check`** — measured **19 files**, i.e. every
`slang-*` topic index, `dark_*`, `MEMORY.md` itself, and the archive. Audited them by hand this turn:
**all 19 currently reachable — by luck of which indexes I happened to write to, not because anything
verifies it.**

**The triager's variant is worse and is the sharper statement of the class:** its closure checker
**skips notes marked `TERMINAL`** — so a mid-turn re-tier of `MEMORY.md` orphaned its `triage-12331.md`
to **zero inbound references**, and the checker stayed silent *because the note had just reached the
state that exempts it*. ⇒ **A reachability tool that filters by status or by name is blindest exactly
where chains go to rest**, which is where they sit longest and get re-tiered without anyone watching.

✅ **Runnable check for the class the prefix walk cannot see** (both roots, recursive, tracked-text only):

```bash
ROOTS="$HOME/.claude/projects/-workspace-agent/memory /workspace/agent/memory"
FILES=$(find $ROOTS -name '*.md')
ls *.md | grep -vE '^(feedback|project|technique|reference|command|user|index)' | while read t; do
  R=0
  while IFS= read -r f; do
    [ "$(basename "$f")" = "$t" ] && continue
    N=$(tr '\n' ' ' < "$f" 2>/dev/null | tr -s ' ' | grep -ciF -e "${t%.md}"); [ "$N" -gt 0 ] && R=$((R+1))
  done <<< "$FILES"
  [ "$R" -eq 0 ] && echo "🔴 ORPHAN: $t"
done
```

⇒ **Two rules.** (1) **Run this after any re-tier or split of `MEMORY.md`**, not on a schedule — the
trigger is *structural change to an index*, because that is what orphans leaves. (2) ⭐**When a tool
reports clean, ask what it does not look at.** `reindex.sh --check` returning `0 orphans` is a true
statement about six prefixes, and I have quoted it as a statement about the store.

⚠️ **Not fixed in the tool.** Widening `reindex.sh`'s walk would change what it regenerates, not just
what it audits — out of scope for a closed chain. Recorded here as the gap plus the manual check.

### ⭐⭐⭐ THE COLLISION: "controlling block at the TOP" DEFEATS a first-N-bytes status filter

slang-triager quoted the mechanism from its tool (`memory-closure.py:106`): a note is skipped when
`TERMINAL|MERGED|SHIPPED|CLOSED` appears in its **first 2000 bytes**. Its own words for the consequence:
*"writing a good terminal block is what made the note invisible — the better the close-out, the earlier
the marker, the more certain the exemption."*

**That collides head-on with a rule I hold and have applied ~all session:** *put the controlling block
at the TOP*, because truncation eats the newest corrections
([[project_memory_files_over_read_limit_backlog]]). Measured on my store 2026-08-06: **327 of 795 files
carry a terminal marker in their first 2000 bytes — 41%.** My own #12331 note carries both `TERMINAL`
and `CLOSED` there, precisely because I front-loaded the close-out.

⭐⭐⭐ **THE STRONGER REFUTATION (triager's framing, replicated on my store): the filter does not
partition by STATUS — it partitions by MARKER POSITION, so two notes in the SAME state get opposite
treatment.** Measured here 2026-08-06: **556 notes carry a terminal marker somewhere; 327 have it in the
first 2000 B (exempted) and 229 have it later (still watched).** Its store: 234 terminal / 86 exempted /
148 watched. **Same status, opposite handling, in both stores** ⇒ the partition is **incoherent on its own
terms**, which is a harder objection than "position doesn't carry intent" — that one concedes the filter
is measuring *something*; this one shows it isn't.

⚠️ **And the exposure is a property of WRITING STYLE, not of the store: 41% here vs 12% there**, from the
same filter, because we front-load close-outs to different degrees. ⇒ **neither of us could have
predicted the other's number, and a single measurement would not have generalized** — the reason to
re-run a peer's ratio on your own corpus rather than adopt it
([[feedback_audit_grep_false_negatives_asymmetric]] makes the same point about case-sensitivity ratios).

⇒ **Two individually-correct rules, one contradiction.** Good practice for *readers* (status first)
is the exact signature a status filter uses to stop watching. Neither rule is wrong; **the filter's
premise — that marker position carries intent about monitoring — is what fails.**

✅ **Resolution, and why not "fix the filter":** a status-ignoring orphan check, run **on structural
index change**. Widening the filter would flag ~40 notes (theirs; ~327 candidates here) that are
*correctly* at rest, and **a tool that cries wolf on every closed chain gets ignored — which costs more
than the gap.** Recorded, not patched.

⚠️ **And the number I'd have mis-quoted.** The triager first reported *"430 orphans"* then caught that
its sweep counted every unreferenced file, while its checker only flags orphans carrying a **live**
marker (`RESUME|AWAITING|HELD|ACTIVE`) — the tool flagged **15**. ⭐**Two denominators, one label.**
Companion to *when a tool reports clean, ask what it does not look at*: **when YOU report a number, ask
whether it answers the tool's question or your own.** Same class as
[[feedback_unattributed_fact_reads_as_your_own]] — a figure that changes meaning in transit.

🔎 **The class in one line, its find:** `feedback_orphan_audit_validate_filters.md` — a note *about
validating audit filters* — was itself unreachable.

### ⭐⭐⭐ A COMPLETE TOTAL BESIDE A TRUNCATED LIST — the worst shape a tool can print

Triager applied my *"every numeric parameter is a scope on its result"* rule to its **tools** rather than
its patterns, and found something worse than the window: `memory-closure.py` carries **two** numeric
scopes with different characters — `body[:2000]` (the exemption) and **`dark_live[:15]`, a PRINT CAP**.
The summary total is **complete (51)**; the printed list is **truncated to 15**. It had asked *"is my
chain in the dark list?"*, read the 15 printed rows, and reported *"not in them"* **as though the list
were the set** — right, but *right by luck of absence everywhere*, not by a sound check.

⭐⭐ **Why this shape is nastier than a bare parameter: the number lends the rows credibility they don't
have.** A truncated list alone invites suspicion; a truncated list *next to an authoritative count* reads
as the complete enumeration of that count. Same family as
[[feedback_unattributed_fact_reads_as_your_own]] (two denominators, one label) — here it is **one
denominator and a partial numerator, printed together.**

✅ **I audited my own tooling instead of assuming.** `reindex.sh --check` prints the total at `:116` and
the orphan list at `:117` **unbounded**, and I verified it **by construction, not by reading**: total
claimed vs rows printed → `1 == 1`. No truncation defect. Per-line truncations in `bin/fragcheck.py:191`
and `bin/nbrcheck.py:128` (`f[:76]`, `m[:96]`) clip *display width*, not list length — a different and
benign class.

⭐ **And running the audit found a live orphan I had been reporting clean:**
`feedback_gh_pr_checks_dedups_runs_rollup_does_not` (created 05:14 by a concurrent sibling session,
0 inbound refs). Adopted via `bash reindex.sh` ⇒ **777/777 reachable, 0 orphans.** ⚠️Its content is the
same class we were both chasing: **`gh pr checks` DE-DUPLICATES repeated runs of one check name while
`statusCheckRollup` returns all — 51 vs 56 on one PR** ⇒ a dedup can hide a RED re-run behind a green
name. *A tool that silently collapses its output is the CI-facing twin of a print cap.*

⇒ **Rule: for any tool you quote, verify `total == rows printed` once, by construction.** Reading the
source for a `[:N]` works only if you already suspect one; comparing the two numbers needs no suspicion.

#### ✅ MY ORPHAN PASS HAS NO PREFIX BLIND SPOT — verified by a PLANTED orphan, not by reading

The prefix gap documented above is real for the **regeneration** walk (`for fam in feedback project
technique reference command user`), but **not** for the orphan pass. `reindex.sh:104-115` walks
`os.walk('.')` **recursively, by extension**, excluding only `index-*`/`MEMORY*`/`reindex`. So a
sibling-written leaf under any name — `triage-12371.md`, `dark_*`, `slang-*` — **is** in its population.

Proven the way this file insists on: **plant the failure and require the tool to notice.**

```
planted triage-99999-probe.md  →  leaves=778 reachable=777 ORPHANED=1, ORPHAN: triage-99999-probe  ✅
removed                        →  leaves=777 reachable=777 ORPHANED=0                              ✅
```

⚠️ **Two scopes in one tool, opposite characters — state which one a finding came from.** The
regeneration walk is prefix-bound (6 families); the orphan pass is extension-bound (everything). My
earlier note "19 files are invisible to `--check`" was about *regeneration*, and I should not let it imply
the orphan pass is equally narrow — it isn't. Same class as the triager's `body[:2000]` vs `dark_live[:15]`:
**one tool, several numeric/name scopes, each needing its own statement.**

⇒ **The pattern across both stores, in its final form: a tool that silently collapses its output — cap,
dedup, window, or prefix — reports a TRUE NUMBER ABOUT A SET YOU NEVER SAW.** (Triager's wording; my
`total == rows printed` check is the cheapest detector for the cap form, and a planted positive is the
detector for the rest.)

##### ⛔⭐⭐⭐ THIRD SCOPE, UNPROBED UNTIL NOW — the READABLE-PREFIX slice, and it is ~2.7 KB from biting

Triager enumerated **four** scopes in its tool and found it had been quoting one word ("closure clean")
for all of them. I did the same enumeration on `reindex.sh` and found a **third** scope I had never
named, let alone probed:

| scope | line | character | probed? |
|---|---|---|---|
| regeneration walk | `:23` | prefix-bound (6 families) ⇒ 19 files not regenerated | ✅ measured |
| orphan pass | `:104-115` | extension-bound, **recursive** ⇒ sees everything | ✅ planted-positive |
| **readable-prefix slice** | **`:93,97`** | **`root[:BOUND]`, BOUND=24986** ⇒ reachability is computed **only from the readable prefix of each index** | ❌ **never probed — until now** |

**Proven by construction with a MEASURED overshoot** (per the numeric-threshold rule — not eyeballed):
a `[[…]]` row planted at offset **25490**, i.e. **504 chars past BOUND**, is `FULL=True / PREFIX=False`.
⇒ **any index row appended past the bound silently stops conferring reachability**, and the orphan count
would then report leaves as orphaned *because the pointer became unreadable, not because it is missing.*

🔴 **This one is live, not theoretical: `MEMORY.md` is 22,246 chars — 2,740 from the bound — and it grew
~5 KB this session alone.** At that rate the scope activates within roughly one more session of appends.
That is the same trap as the original 221 KB flat index, arriving through a different door: not "the file
is unreadable" but "the *checker's* view of the file is."

⇒ **Two additions.** (1) **Report headroom with every orphan count** — `ORPHANED=0` is only meaningful
while the index fits inside BOUND. (2) ⭐**Never let one pass's limitation stand as "the tool's
behaviour"** (triager's wording): name the pass. Mine has three, with opposite characters, and I had
described the tool by whichever one I had most recently measured.

###### 🔴 FOURTH DOOR — MY CHILDREN OUTGREW THE READ BOUND WHILE I APPENDED TO THEM

Triager's exposure is via a **different mechanism** than my prefix slice: not *"the checker's view of the
index is truncated"* but *"the rule file itself outgrows a read."* Its counter was clear (481/2000 lines).
**Mine was not — measured 2026-08-06:**

| file | lines | bytes | vs 24.4 KB read bound |
|---|---|---|---|
| `feedback_audit_grep_false_negatives_asymmetric.md` | 955 | **67,694** | 🔴 **42,708 PAST** |
| `slang-evidence-lessons-index.md` | 72 | **32,313** | 🔴 **7,327 PAST** |
| `technique_keeping_this_store_reachable.md` | 340 | 23,737 | ok (1.2 KB headroom) |
| `feedback_correction_must_sweep_whole_file.md` | 253 | 24,124 | ok (862 B headroom) |

**Five of this session's own lessons sit past the bound in the child** — `SIXTH FORM` @58,040,
`APERTURE LADDER` @59,776, fixture-testing @61,828, load-bearing @63,892, windowed-zero @65,804. I appended
every one of them to a file that had already stopped being readable in full. ⭐**The bound is on the READ,
not the write** — nothing errored, and each append verified fine because my probes read the *file*, not the
*readable prefix of the file*.

✅ **Not dark, though — checked before claiming it:** each of those five is also carried in the index hook
at offsets ≤20,830, inside the bound. So they remain retrievable by the intended path (hook → child), which
is exactly what the two-tier structure is for. **The child is the archive; the hook is the retrieval
surface.**

⚠️ **And my first audit of that said three were ABSENT from the hook — a probe defect, not a gap.** I
probed `FIXTURE-TESTED` (hook says `FIXTURE-TEST`), `SIXTH FORM` (hook says `sixth form`), and
`LOAD-BEARING IS A PROPERTY` (hook says `LOAD-BEARING DIFFERS PER AUTHOR`). Normalized for case, emphasis
and inflection: **all three readable.** Mechanisms 2 and 7 plus the aperture ladder, firing inside the
audit that documents them — **the fourth time this session that an audit of a rules file broke on the rules
it documents.**

⇒ **Report BOTH bounds per file, and treat the char bound as the binding one here** — 955 lines is far
from 2000 while 67,694 bytes is 2.7× the char bound. **A line counter would have said "clear" all session.**

####### ⭐⭐ AFTER A COMPACTION, MEASURE INBOUND COUNT *AND* NAME THE SURVIVING PATH

Triager's check, which I had not run on my own cut: after compacting an index row, its memos went from
**inbound=2 to inbound=1** — and rather than treating that as degradation it **named the surviving path**
(`index-project → project_* leaf → triage memo`) and confirmed what it removed was the *redundant
duplicate in the row*. **That is the two-tier design working, not a loss.**

Ran the same check on my L17 compaction (−4,139 chars). Inbound after:

| target | inbound | intended path intact? |
|---|---|---|
| `technique_keeping_this_store_reachable` | **4** | ✅ `MEMORY.md → child` |
| `feedback_audit_grep_false_negatives_asymmetric` | **22** | ✅ `MEMORY → evidence-index → child` |
| `slang-evidence-lessons-index` | **9** | ✅ `MEMORY.md → hook` |

⇒ **A drop in inbound count is not itself a finding — the question is whether the INTENDED route still
runs end to end.** Two surfaces pointing at one child is often duplication, and removing one is the point
of compacting. But a count alone cannot tell you which one you removed, so:

✅ **After any compaction: (1) inbound count per touched target, (2) walk the intended path hop by hop,
(3) positive-sweep the cut data against the child.** Step 2 is the one that distinguishes "removed a
duplicate" from "removed the only route"; steps 1 and 3 both pass in either case.

⚠️ Same class as *marker-count is not item-count*: **inbound=1 is a number about references, not about
reachability by the path a reader actually takes.**

######## ⭐⭐⭐ WALK HOPS BY *OFFSET*, NOT EXISTENCE — and state the route before you test it

Triager's refinement to my three-step check, and it caught a real gap in what I ran: **I verified hop
EXISTENCE, not that each hop sits at a READABLE OFFSET.** Those come apart precisely because of the
prefix scope — **a hop can exist and still be dark**, and existence-only passes either way.

Re-walked my routes with offsets (normalized for case/emphasis/wrap):

| route | hop | offset | verdict |
|---|---|---|---|
| evidence | `MEMORY.md → slang-evidence-lessons-index` | 12,957 | ✅ |
| evidence | `evidence-index → audit child` | 16,872 | ✅ |
| store-hygiene | `MEMORY.md → technique_keeping…` | 3,570 | ✅ |
| **#12331** | `MEMORY.md → slang-shipped-index` | **15,114** | ✅ |
| **#12331** | `slang-shipped-index → chain note` | **17,935** | ✅ |

⚠️ **And the offset walk produced a false alarm I had to resolve: `MEMORY.md → project_12331…` came back
`absent`.** True, and *correct by design* — after the parked→shipped move the route is **2 hops**
(`MEMORY → shipped-index → chain note`), not a direct edge. **I had probed a route that should not exist.**

⇒ ⭐⭐ **State the intended route BEFORE testing it.** A hop-by-hop walk against an *assumed* topology
reports "absent" for edges that were deliberately removed — indistinguishable, in the output, from a
broken route. Same shape as the aperture ladder: the pattern must match the *actual* structure, not the
one you remember. The fix is one sentence written first: *"the route is A→B→C"* — then measure exactly
those hops.

✅ Final form of the post-compaction check, four steps:
1. inbound count per touched target (**cannot** discriminate duplicate-vs-only-route)
2. **name the intended route explicitly**
3. **walk it hop by hop, recording each OFFSET against the bound** (existence is insufficient)
4. positive-sweep the cut data against the child (**cannot** discriminate either)

Only **2+3** discriminate; 1 and 4 pass in both the good and the bad case.

######### ⛔⭐⭐⭐ A THIRD ROOT — and a FAILED COMMAND that read as "genuinely dead"

Triager found its route's last hop was a **cross-mount edge** into `/workspace/agent/memory/`, invisible
to a single-root BFS: the traversal *cannot distinguish "route ends here" from "route continues on another
mount."* I tested my store for the same shape and got a different, worse answer.

**Cross-mount edges A→B: 0.** But well-formed wikilinks resolving in **neither** root: **50**. And they
are not dead — most are **hyphenated slugs pointing at `/workspace/shared/learnings/` (3,107 files), a
THIRD root** my orphan pass never considers. Under lossy matching (punctuation-stripped, lowercased,
~28-char prefix — the documented slug transform), 3 of 4 sampled resolve:

```
a-corrections-blast-radius-includes-derived-artifacts        ✅ resolves (lossy)
a-grep-returning-0-is-only-evidence-if-the-positive-control…  ✅ resolves (lossy)
agent-ncl-restart-cant-target-another-group                  ✅ resolves (lossy)
disk_full_fixer_reap_frees_nothing                           ❌ genuinely dead
```

⇒ **My orphan pass is single-root for TARGETS as well as sources.** `ORPHANED=0` has always meant *0
among leaves in root A*, and a wikilink into the shared store reads as dead to any exact-match check.
**Report the root set with the count**, exactly as with the aperture and the bound.

⛔ **AND MY FIRST RUN OF THAT TEST WAS A FAILED COMMAND READ AS A MEASUREMENT.** `tr -d '-_'` errored —
`tr: invalid option -- '_'` — because `-_` parses as flags. The pipeline still printed my else-branch, so
**all four probes reported "genuinely dead" from a command that never ran.** That is precisely the
exit-2-isn't-evidence trap this store documents for leading-dash tokens, and it produced the *confident,
actionable* direction: I was one step from "fixing" 50 links that were never broken.
✅ Redone in Python (no shell quoting layer): 3 of 4 resolve.

⭐⭐ **The general form: a broken instrument fails toward the answer that licenses work.** An erroring
check printed "dead" not "unknown", because the error path fell through to the negative branch. **Every
check needs its failure to be distinguishable from its negative result** — the `CANNOT VERIFY` third
outcome, applied to shell pipelines rather than to file absence.

########## ⭐⭐⭐ MY "50 DEAD WIKILINKS" WAS 5 REPAIRS AND 24 NAMED UNKNOWNS — classify before repairing

Triager's three defects applied to my earlier **50**. Narrowed the same way, and the count moved because
of *my* measurement, not the store:

| step | dead count |
|---|---|
| raw wikilink regex | **50** |
| **strip code fences + spans first** (its defect #1) | **31** |
| drop `len<12` / noise (`...`, `wikilink`, `feedback_...`) | **29** |
| unique punct-normalized target found | **5 REPAIRABLE** |
| no match under exact/normalized | **24 NAMED UNKNOWNS** |

⚠️ **My store had 0 attribute-syntax false positives** — its 19 (`[[vk::binding]]`, `[[buffer(0)]]`) live in
its triage memos, which quote shader source; mine quote it inside code spans, which the strip removes.
**Same regex, same class, different exposure** — the fourth per-corpus divergence this session.

✅ **The 5 repairs, all hyphen-for-underscore slug variants with a UNIQUE punct-normalized target:**
`feedback-capability-negative-…`, `feedback-green-job-skipped-backend-zero-coverage`,
`feedback-verify-elapsed-time-from-live-artifact`, `project-12182-cuda-optix-callable-rdc-linkage`,
`project-8306-embed-core-glsl-module-slang-dll`. Applied to 5 files; **targets byte-untouched (verified by
size before/after)**.

⭐⭐ **Negative control made PLAUSIBLE, per its defect #2:** random `zqx-…` strings prove nothing since they
share no vocabulary. I used **vocabulary-sharing fabrications** —
`feedback-green-job-skipped-backend-fabricated-tail`, `agent-ncl-restart-fabricated-suffix-qq` — and both
correctly returned nothing while the must-hit probes resolved. **A matcher that cannot fail is not a
matcher.**

⭐ **Both arms of the repair verified, not just one:** old form **0 refs**, new form **34 refs**. Checking
only the old form's absence cannot distinguish "renamed correctly" from "deleted the link."

⛔ **The 24 unknowns are recorded as unknowns, not guessed.** Its defect #3 is why: token overlap finds a
*neighbour*, not a target (`cuda-prelude-nvcc-repro` scores 0.75 against a different document). **A
plausible near-match is the failure mode of fuzzy repair** — leaving a named dangling link is honest;
pointing it at a topical neighbour is a fabrication that reads as a fix.

⇒ **Rule: classify a dangling link (attribute syntax · noise · slug-variant · genuine unknown) BEFORE
repairing any of it.** A single count over all four classes is not actionable, and the largest class is
usually not the defect.

########### ⛔⭐⭐⭐ MY "20 UNLINKED FILES" WAS **0** — a basename-keyed dict silently dropped my own index

Ran triager's inverted pass (*strip code spans to COUNT links; scan code spans to FIND unlinked files* —
its rule, and a real gap in my instrument). It reported **20 unlinked**, two of them mine and
load-bearing: `slang-evidence-lessons-instruments` (8,462 B) and `slang-verify-lessons-pointers`
(4,659 B, created this session).

**Both are `[[wikilinked]]` from `MEMORY.md`.** So I diagnosed the instrument instead of repairing the
store, and the root cause is **the exact hazard the triager flagged as unaddressed — landing in my
detector rather than in a reader's path:**

```
my scan:  files[basename] = path      # dict keyed by BASENAME
collisions (root B silently overwrote root A):
  MEMORY                     A=21,952 B   B=10,964 B   <- dict kept B
  index                      A= 5,007 B   B=    86 B   <- dict kept B
  project_12307_reflection…  A= 1,883 B   B= 8,018 B   <- dict kept B
```

⇒ **`MEMORY.md` itself collides**, so the scan read root B's 10 KB `MEMORY.md` as "the" index and **every
link in my own 21,413-char index was invisible to the linked-set.** Re-keyed by **full path**: 883 files
(+4 recovered), **UNLINKED = 0.**

⭐⭐ **The general defect: a basename-keyed collection over multiple roots is lossy by construction, and it
loses silently — last-writer-wins, no error, no warning.** A wikilink *is* basename-keyed, which is why
this hazard bites readers too; but a **tool** keyed the same way computes reachability from the wrong
document entirely. ⇒ **Key every multi-root traversal by full path; use the basename only for matching,
never for identity.**

⚠️ **And note which direction it failed:** it manufactured **20 findings**, i.e. work. Same family as the
`tr -d '-_'` failure and the always-firing guard — **an instrument defect that produces findings is more
expensive than one that hides them, because you act on findings.** I nearly "repaired" 20 files that were
already correctly linked, including two I had just written.

✅ The triager's inverted pass still earned its keep on my store — **2 files mentioned only in backticks**
(`definition`, `slang-evidence-lessons-instruments`) — but the count that mattered was **0 genuinely dark**,
recoverable only after fixing the key.

############ ⭐⭐⭐ COLLISIONS ARE INTRA-ROOT TOO, AND THE DIRECTION FLIPS — plus: STATE THE REACHABILITY CONTRACT

Two refinements from slang-triager, both verified here rather than adopted.

**1. "Which root?" is the wrong question — the answer is a path.** My collisions, enumerated over both
roots *including within a root*:

| basename | kind | copies |
|---|---|---|
| `MEMORY.md` | cross-root | A **22,867** / B 10,964 |
| `index.md` | **INTRA-root (B)** | `index.md` **5,007** / `slang/index.md` 793 / `system/index.md` 86 |
| `project_12307_reflection_json_scope_representation.md` | cross-root | **B 8,018** / A 1,883 |

⇒ **A two-root framing cannot express row 2**, and row 3 shows **the fuller copy is not consistently in
one root** — so there is no safe "prefer root A" shortcut. Its store shows the same flip on
`triage-11983` (fuller in B). **Full path is the only identity.**

**2. ⛔ STATE THE REACHABILITY CONTRACT BEFORE REPORTING AN ORPHAN COUNT — and it is per-store.** Its
"12 unlinked" was a *link-walk figure over a convention-reached store*: its root B is 504 files, 456
`triage-*`, reached by the deterministic path `/workspace/agent/memory/triage-<n>.md` that `CLAUDE.md`
cites, **not by links** — a raw link-walk there reports ~469 unlinked, and its genuine residual is **3**.
**Correct arithmetic over the wrong population — the same shape as my 20.**

✅ **Measured mine instead of inheriting the analysis: my root B is 77 files (not 504), and it is
LINK-reached — link-unreached = 0.** So no contract mismatch on my side, and its correction does not
transfer. ⭐ **Third instance today of "re-run a peer's measurement on your own corpus": its root B and
mine share a path and a name and are different stores.**

⭐⭐ **The durable half, now on its third instance** (`tr -d '-_'` → "dead" · the always-firing guard · the
basename dict → 20 phantom findings): **an instrument defect that MANUFACTURES findings costs more than
one that hides them, because you act on findings.** Key by full path; basename for matching only, never
identity.

############# ⛔⭐⭐⭐ REDISCOVERY — MY STORE ALREADY HELD THE MOUNT FACT (since 08-05 21:45)

Before the section below stands, the honest correction: **[[feedback_identical_paths_hold_different_files_per_agent_group]]**
(4,354 B, written 2026-08-05 21:45, indexed at `index-feedback-5`) already records **"THREE memory roots, not two:
`/home/node/.claude` is bind-mounted per agent group"** — *and* the `ro` asymmetry. I re-derived all of it from
`findmnt` and presented it as new. Fragment check against that leaf: **three-root framing ✅ already present ·
per-agent-group bind ✅ · `ro` ✅**; genuinely new today are only **"unverifiable, not disputable"**, the
**reachability-contract** point, and the **column-label** class.

⭐⭐ **Why it did not retrieve, same diagnosis the triager reached independently: I came at it from FILE COUNTS,
and the leaf is filed under path-collision.** Nothing in its framing answers *"why do our store figures differ"* —
the incident that taught it was a different question from the one I was asking. **Filing a rule is not retrieving
it: index by the QUESTION you will ask, not only by the INCIDENT that taught you.** Both of us paid a full round
for the same retrieval failure, on the same fact, in the same hour — which is the strongest possible evidence that
the defect is in the indexing, not in either store's content.

⇒ Sibling leaves that should have been reached: [[feedback_group_clone_is_shared_by_all_sibling_sessions]],
[[feedback_never_state_a_peers_filesystem_figure_as_measured]] — the second is *exactly* the rule I needed.

############# ⭐⭐⭐ PRIVATE MOUNTS: a cross-store figure is UNVERIFIABLE, not disputable — plus the ID/COLUMN class

**1. Measured my own mounts, and the triager's mechanism holds with two differences:**

| root | my source | its source |
|---|---|---|
| `/home/node/.claude` | `…/v2-sessions/`**`ag-1776713211742-1w6l4e`** | `…/`**`ag-1780667166418-apezq5`** |
| `/workspace/agent` | `…/nanoclaw/groups/main` | `/dev/vdb[/prod-groups/slang-triager]` |
| `/workspace/shared` | `…/data/shared` — **rw for me** | same path — **ro for it** |

⇒ **Two of three roots are per-agent-group private binds**, so its "root B = 504 files" and my "77" were
never the same object: **a cross-store figure is unverifiable, not disputable — record with attribution
and stop.** ⭐ The tell was that the *store identity* differed, not the value (my `B/slang/index.md`
collision arm is a subdir it does not have). And the shared root is **asymmetric**: I can write it, it
cannot — so "shared" does not mean "symmetric".

**2. ⛔ Its false attribution, live since 2026-07-11, is a class I carry too.** Ground truth via
`ncl destinations list`: `…166439` = **slang-fixer**, `…166418` = **slang-triager** — minted **21 ms
apart**, so the ids agree to 16 digits and diverge in the last two. It had recorded its *own* group id as
the fixer's, silently naming itself as the coworker that was auth-down.

**Audited my 62 id citations against ground truth: 0 truncations, and 2 of 3 flags were false** (correct
prose that merely mentions another coworker nearby). **One was a real defect, of a different shape:** I
had quoted a raw `ncl` row —

```
ag-1780667166418-apezq5  slang-fixer  agent  ag-1780667166439-vmjrwe
```

— whose columns are **SOURCE-group | DESTINATION-name | kind | DESTINATION-id.** It is an *edge*
(triager→fixer), but **quoted without column labels it reads as the identity claim "`…166418` IS
slang-fixer"** — exactly the mis-attribution the triager made from the other direction. Fixed with the
columns named inline; both arms checked (bare form 0, labelled form 1).

⭐⭐ **The unified rule, and it is the basename lesson one layer up:** **an identifier truncated to — or a
table row quoted without — the field that disambiguates it resolves to the wrong object with no error.**
Full path for files · full group id for agents · **column names for any pasted tabular row.**

############## ✅ THE HARDER ARCHIVE TEST, RUN ON MY STORE: 23 archive-only ROWS, **0** lost leaves

Triager ran *"which archive rule sentences exist nowhere live"* and found **26 of 58**, of which **12 were
method rules** and one routing row (#12326) was held by **no** live surface — a genuine gap it then filled.
I ran the same test with a case+emphasis+dash normalizer (its own finding: **archives are written in
emphasis forms the live prose does not use**, so a case-sensitive probe against an archive is a
*systematic* false negative — the third normalizer gap after markdown `**` and line wraps).

**My result is materially different, and the difference is the finding:**

| measure | count |
|---|---|
| archive rule lines examined | 61 |
| no 8-word run anywhere live | **23** |
| …whose **leaf exists live** (only the row's wording is gone) | **23** |
| …with **no live leaf at all** (genuine content loss) | **0** |

⇒ **"Archive-only line" ≠ "lost rule."** Spot-checked three: every live leaf's `description:` is **richer**
than the archive row it replaced (*"the claim that closes an investigation is the one nobody checks — the
mechanism is relief"* vs the archive's *"a fact that lets you stop investigating"*). **That is compaction
working as designed** — the row was a pointer, the leaf is the store.

⭐⭐ **So the test needs its second step or it manufactures 23 findings:** for each archive-only line,
**resolve its link targets against the live file set.** Row-gone-leaf-present is expected; leaf-absent is
the defect. Without that partition I would have "restored" 23 rows that are strictly worse than what
replaced them — the *manufactures-work* failure direction again, and the same shape as
[[feedback_audit_grep_false_negatives_asymmetric]]'s marker-vs-item rule.

⚠️ **The one exception is real and already handled:**
[[feedback_a_rule_that_doesnt_fire_is_a_retrieval_failure]] *was* leaf-absent — archive-only with no live
descendant — which is why the same test yielded a genuine restore an hour earlier. **Same test, two
outcomes; only the leaf-existence check tells them apart.**

⭐ Triager's own instance of the shape is the cleanest statement of it: it committed the backtick defect
**one message after publishing the rule against it**, and the live-archive line it quotes —
*"a rule is at its weakest precisely when you are working on the rule"* — is itself one of its
archive-only lines.

## ⛔ A DISCRIMINATOR'S CLEAN RESULT MAY BE COVERAGE, NOT CORRECTNESS

Measured 2026-08-06, testing the peer's third step against my own store.

My archive test partitioned 23 archive-only lines as **23 row-gone / 0 leaf-absent** by resolving
each line's `[[link]]` targets against the live file set. The peer ran the same test on its store and
needed a **third** step — co-occurring distinctive terms — because 19 of its 26 archive-only lines
carry **no links at all**, so the link check cannot classify them.

The measurement that explains both results:

| | mine | peer's |
|---|---|---|
| archive rule lines | 61 | — |
| linkless | **2 (3%)** | **19/26 (73%)** |
| links-per-line | `{0:2, 1:51, 2:7, 4:1}` | — |
| linkless *within* the archive-only set | **0** | 19 |

Both of my linkless lines had a live 8-word run, so they never reached the partition. **My second
step was armed on 100% of the lines it had to classify — by archive shape, not by design.** Had my
rows been written the way its were, my method would have returned 23 unclassifiable lines and I would
have read that as a clean pass.

⭐⭐⭐ **A discriminator that returns a clean result tells you nothing until you measure the
population it could not see.** `0 leaf-absent` and `0 linkless` are the same digit reported by an
armed check and an inapplicable one. The question is never "did the check pass" but **"on how many
rows could the check fire at all?"** — report the denominator beside every clean partition.

⭐⭐ **Corollary — the general method is the one that needs no metadata.** Link resolution is a
shortcut that works only where a previous writer happened to leave links; co-occurring distinctive
terms works on any prose. Prefer the metadata-free discriminator as the primary and use the shortcut
only as a cheap pre-pass, because **you cannot tell from the output which one you were relying on.**

⇒ Companion to the earlier finding that without the second step this test manufactures 23 findings.
Both are the same failure at different layers: a step's absence inflates the finding count, and a
step's silent inapplicability deflates it. Neither is visible in the number itself.

## ✅ ARMING THE ORPHAN GATE — proven on demand 2026-08-06 (2 commands)

⛔ **I published `ORPHANED=0` ~a dozen times in one session without ever showing the check CAN return
non-zero** — the inert-guard failure this store keeps at depth zero, committed against my own
instrument. A peer proving *its* reachability gate first is what prompted the test; I would not have
run it otherwise.

```bash
cd /home/node/.claude/projects/-workspace-agent/memory
printf -- '---\nname: zzz_control_orphan_delete_me\ndescription: "CONTROL — delete me."\nmetadata:\n  node_type: memory\n  type: feedback\n---\n\nControl.\n' > zzz_control_orphan_delete_me.md
bash reindex.sh --check   # MUST report ORPHANED=1 and NAME the file
rm -f zzz_control_orphan_delete_me.md
bash reindex.sh --check   # back to ORPHANED=0
```

**Measured:** `leaves=891 reachable=890 ORPHANED=1` + `ORPHAN: zzz_control_orphan_delete_me`, then
`890/890/0` after removal. So the gate detects an unreferenced leaf **and** identifies which — not
merely a count.

⚠️ **ORDER IS LOAD-BEARING: run `--check`, never `reindex.sh`, while the control is planted.** A full
reindex would *link* the control from its family index, the orphan count would stay 0, and the arming
test would falsely pass. ⭐⭐⭐ **The arming test can itself be inert** — which is the same class as the
thing it exists to detect, one level up.

⇒ **A clean gate reading is worth nothing until that gate has failed on demand in the same session.**
Pair every published `ORPHANED=0` with either a fresh arming run or a pointer to this procedure.

## ⛔ THE ARMING TEST NEEDS ITS OWN VALIDITY ARGUMENT — my control passed by luck of its name

**2026-08-06, immediately after the arming run above, prompted by `slang-triager` finding the same class
in its own gate.** *"I planted a control and the guard fired"* is evidence **only if the control was
ELIGIBLE TO BE CAUGHT.** Measured on `reindex.sh`, three controls, same content, differing only in name:

| control filename | result | why |
|---|---|---|
| `zzz_control_orphan_delete_me.md` | ✅ `ORPHANED=1`, named | matches no special prefix |
| `slang-zzcontrol-probe.md` | ✅ `ORPHANED=1`, named | `slang-` is an *index* prefix (`:96`) but still counted as a leaf |
| **`index-zzcontrol.md`** | ⛔ **`ORPHANED=0` — SILENTLY ABSORBED** | `:111` excludes basenames starting `index-`/`MEMORY`/`reindex` from the **leaf set** |

⇒ **Had I named my control `index-…`, the gate would have reported a clean `891/891/0` with an
unreachable file sitting in the store, and I would have published that as proof the gate works.**

⭐⭐ **BE PRECISE ABOUT THE MECHANISM — it is NOT the same as the peer's.** Theirs: a control
*legitimately reachable* by a path convention, i.e. **absorbed into the numerator** (`reachable`). Mine:
a control **excluded from the denominator** (`leaves`) by an ignore-list at `reindex.sh:111`, so it is
neither reachable nor orphaned — it does not exist to the gate at all. **Same failure class
("ineligible control reads as a pass"), two different mechanisms.** Per this store's counting rule, the
*class* now has 2 cases; each *mechanism* has one.

⇒ ⭐⭐⭐ **A control must be drawn from the population the gate actually scans.** Before trusting an
arming run, read the gate's exclusion list and its reachability routes, then pick a control that no
route can claim. **Two of my three candidate names were safe and one was not — a 1-in-3 chance of
"proving" the gate with a test that measured nothing.**

⚠️ **Where to stop, and the peer drew this line first:** it fixed the hole *in the instrument*
(`--self-test` plants both control types through the gate's own code path and asserts it distinguishes
them) rather than in prose, on the grounds that *"a procedure kept in prose is exactly what gets
skipped"* — correct, and this section is that prose. But it declined to write a test for the test:
**the self-test carries its own arming argument (it fails if either control misbehaves or leaves
residue), and another meta-round is not the product.** The recursion has a floor; take it.

### Route inventory for `reindex.sh` — read this before picking a control

Enumerated from source (`reindex.sh:104-116`), then each verified by planting a control:

| route | source | control | gate says |
|---|---|---|---|
| eligible (no route claims it) | — | `zzz_control_orphan_delete_me.md` | ✅ `ORPHANED=1`, **named** |
| eligible, despite an index-ish prefix | `:96` treats `slang-*` as an index *for linking*, but `:111` doesn't exclude it | `slang-zzcontrol-probe.md` | ✅ `ORPHANED=1`, named |
| **denominator — basename ignore-list** | `:111` `startswith(('index-','MEMORY','reindex'))` or `=='index'` | `index-zzcontrol.md` | ⛔ **invisible** (`891/891/0`) |
| **denominator — pruned directory** | `:106` `dns[:]=[d for d in dns if d not in ('.git','node_modules')]` | `node_modules/zzselftest.md` | ⛔ **invisible** (`leaves` unchanged) |

⇒ **My gate has BOTH of the peer's denominator instances and neither of its numerator one** (it has no
path-convention reachability — `:113-115` is basename-or-relpath *linking*, not a convention route). So
the class's mechanism tally across the two gates: **numerator ×1 (theirs), denominator ×2 (both of us)**.

⚠️ **Two counting traps hit while running this, worth as much as the table:**

1. ⛔ **A control big enough to trip a DIFFERENT check cannot measure the one you're testing.** The
   peer's first `index-` probe reported `FAIL: 1` — but from a `DARK APPEND` check firing on the 27 KB
   file it had copied as the control, not from reachability. It would have recorded "index- controls are
   caught" from a check that never looked. Re-run with 6 bytes ⇒ absorbed. **Use the smallest possible
   control.**
2. ⚠️ **`leaves` moved 891→892 between my runs from the CONCURRENT WRITER, not from my control** — the
   pruned-dir control showed `892` both planted and removed, which is what proves it was never counted.
   **In a store with two writers, read the DELTA you predicted, never the absolute** ([[feedback_orphan_check_races_a_concurrent_writer]] family).

✅ **Residue verified zero:** `find . -name 'zzselftest*' -o -name '*zzcontrol*'` → empty; `node_modules`
removed; `892/892/0`.

⛔ **STOPPING HERE, and the floor is a real decision, not fatigue.** The peer put its route inventory
*in the instrument* (`--self-test`, one control per route, expected delta per row, residual assert) —
strictly better than this table, because prose is what gets skipped. Mine stays prose: a deliberate
weakness, accepted because **four rounds on the guard of a memory index is already past proportionality**
when two substantive compiler questions sit open on #12392/#12397. ⇒ **The recursion ends where the
guard's own failure mode is loud. Naming where you stopped, and why, is part of the finding.**

---

## OPEN REPAIR — broken citations found 2026-08-09 ~03:00, deferred to rested judgment

⛔ **A `[[name]]` in this store is NOT evidence a file exists. Measured on my own edge 08-09: closure
1,232 names / 1,102 with a file / **130 phantoms (10.6%)**.** A prefix-roots-only check said 62/62
clean and was TRUE-AND-NARROW — **phantoms live throughout the closure, not at the root**, so checking
roots proves nothing about depth.

⭐⭐⭐ **MOST URGENT — `feedback_a_control_that_fires_by_luck_is_not_a_control` is cited BY NAME in
MEMORY.md standing rule #4 (depth zero) and NO SUCH FILE EXISTS.** That rule governs every control I
plant; its derivation is unreachable from its own pointer. Repair first: either write the leaf or
re-point the citation at the real target ([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]
carries the lucky-control material).

Other genuinely-broken citations (file absent, name plausible, no underscore/hyphen twin):
`feedback_a_bail_is_not_a_pass` · `feedback_a_fix_inherits_the_burden_of_proof` ·
`feedback_a_green_ci_run_is_not_a_green_pr_check_the_required_set` ·
`feedback_praising_self_correction_breeds_false_retractions` ·
`feedback_never_cite_a_peers_artifact_from_its_summary` · `project_12430_existential_static_requirement_ice.md`

⚠️ **CLASS 5 — TRUNCATED CITATIONS, a link that was NEVER valid rather than one that broke.**
`feedback_a_negative_control_must_va…` · `feedback_a_shape_dependent_figure_m…` · `project_11989...` ·
`project_12148...` · `project_8125...` — **an ellipsis was stored as part of the link name**, from prose
compressed with a display truncation then saved as a reference. **No spelling normalization can reach
these**; only restoring the full name works. Distinct from hyphen/underscore drift.

✅ **PERMANENT ACKNOWLEDGED CLASS, never a cleanup: `[[...]]` is C++/HLSL attribute syntax.** In a
compiler engineer's notes `[[vk::binding(0,1)]]`, `[[nodiscard]]`, `[[texture(0)]]`,
`[[required_threads_per_threadgroup(32,1,1)]]` keep arriving forever. Also permanent: prose naming the
syntax (`[[wikilinks]]`, `[[name]]`, `[[leaf]]`), doc placeholders (`[[foo]]`, `[[real_leaf_name]]`),
and planted controls (`[[bogus_dangling_ctl2]]`).

⛔ **MY CLASSIFIER WAS THE BIGGER DEFECT — 92 of 130 landed in a bucket I named "CANDIDATE REAL
misspelling", which was just everything my four negative patterns failed to match.** ⭐⭐⭐**A default
class named for what you HOPE it contains is the same defect as ranking a free-text field as if it were
a label** — the residual bucket inherits a confident name and you act on it. ⇒ **name the default class
`UNCLASSIFIED`, and report its size as a defect in the classifier, not a finding about the data.**

⇒ **Repair order: standing-rule-4 citation, then the 6 plausible names, then decide per class-5 name
whether the full target exists. Do NOT bulk-normalize — [[feedback_cheap_to_verify_became_substitute_for_verified]].**
