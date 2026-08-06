---
name: technique_keeping_this_store_reachable
description: "How to keep this two-store memory readable: run reindex.sh (families + size-packed shards + orphan audit). The metric is ORPHANS-FROM-THE-READABLE-PREFIX, never file size. Covers the 4 defects measured 2026-08-05 — over-bound indexes, the append write path, equal-row-count sharding, and a second store reachable only via a prose-mentioned index."
metadata:
  node_type: memory
  type: technique
  originSessionId: 9872-scrub-redrive
---

# Keeping this store reachable — the procedure and the four defects behind it

**One command.** `bash /home/node/.claude/projects/-workspace-agent/memory/reindex.sh`
(add `--check` for a read-only audit; nonzero exit if any leaf is orphaned).
It regenerates every family index, re-packs the oversized ones into size-balanced shards, and then
verifies. ⭐⭐⭐ **The metric is ORPHANS-FROM-THE-READABLE-PREFIX, never file size** — a 4 KB index with
one dark link is worse than an 18 KB one with none.

State when this was written: **store A 732/732 reachable, 0 orphaned; store B 60 reachable, 16 residual
(all named scratch, 0 memory-bearing).**

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
