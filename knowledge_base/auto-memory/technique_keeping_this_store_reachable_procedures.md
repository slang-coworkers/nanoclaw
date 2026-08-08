---
name: technique_keeping_this_store_reachable_procedures
description: "Verbatim spill of MEMORY.md's TAIL-CUT RECOVERY block (glob-free rebuild-from-disk, three instruments in bin/, the second mount) and the WRITING RULE for this store (own-leaf-not-a-paragraph, ~200-char description budget, oversize-description census). Moved 2026-08-07 because MEMORY.md was 21.1KB CHARS against a 17.1KB budget the hook measures in CHARS, not bytes."
metadata:
  node_type: memory
  type: technique
---

# Store-maintenance procedures spilled from MEMORY.md

⛔ **Moved verbatim 2026-08-07 04:2xZ.** `MEMORY.md` measured **21,641 chars / 22,196 bytes** against the
compaction hook's **17.1 KB budget — which is in CHARACTERS, not bytes** (a peer calibrated this: the hook
reported 21.2 KB exactly when `chars/1024 = 21.2` while bytes read 21.7, matching the UTF-16
`MEMORY_FILE_BUDGET_CHARS` loader budget). ⭐**Tuning a trim against bytes when the enforcer counts chars is
the same unexamined-reference error as trusting a stale baseline.** Nothing below was rewritten — byte-copied.

## ⛔ TAIL-CUT RECOVERY — rebuild from disk, no surviving link required

⛔**GLOB-FREE BY DESIGN.** The prior version of this block enumerated by prefix
(`ls slang-*.md dark_*.md`, `ls feedback_*.md technique_*.md …`) — ⛔**a glob index is blind to exactly
the size of your naming inconsistency, and it fails SILENTLY: a file matching no prefix simply does not
appear, with no error.** Measured 08-05: the six globs covered 727 of 729 files and missed
**`MEMORY-full-archive-*.md`** — i.e. the archive that is this block's own fallback. **List the
directory; grep for the prefixes only to sort what you find.**

```
# 1. THE WHOLE STORE, no prefix assumptions
cd /home/node/.claude/projects/-workspace-agent/memory && ls *.md | wc -l && ls *.md

# 2. The archive of the pre-rebuild flat index (the globs missed this)
ls MEMORY-full-archive-*.md

# 3. Instruments — NOT .md, so every glob above is blind to them
ls bin/*.py     # THREE tools, three questions a single one cannot answer:
#   fragcheck.py  content: is X present?  (given X)
#   nbrcheck.py   loss:    did this edit destroy anything? (harvests the expected set)
#   rootcheck.py  universe: which ROOT does this reference resolve in? (sibling-authored;
#                 tier-2 errors — wrong universe entirely — are invisible to widening a
#                 search within one root, so neither tool above can see them)

# 4. SECOND MOUNT — 71 files that exist ONLY there; no glob in this store can reach them
ls /workspace/agent/memory/*.md /workspace/agent/memory/*.json 2>/dev/null | wc -l

# 5. Live chains: read the description: field, do not trust the filename
grep -l 'RESUME' *.md
```

Regenerate a family index after adding a memory (idempotent, reads `description:` from each file):
```
fam=feedback; { printf -- '---\ntype: index\n---\n\n# %s_*\n\n' "$fam"; for f in ${fam}_*.md; do n="${f%.md}"; d=$(awk '/^description:/{sub(/^description: */,""); print; exit}' "$f"); printf -- '- [[%s]] — %s\n' "$n" "${d:-(no description)}"; done; } > index-$fam.md
```

## Writing rule for this store

⭐⭐⭐ **A new lesson goes in its own leaf file with a tight `description:`, and its family index is regenerated. It does NOT get a paragraph here.** Every anchored paragraph appended to the top of the old index pushed ~2KB of older rows past the read bound — the store grew while becoming less reachable, and each rescue row displaced more ([[feedback_a_remedy_that_can_reproduce_its_own_bug]]). Keep the `description:` field under ~200 chars: it is the retrieval surface, and at 667 entries the median is 167 but the max was 1905.

✅ **Frontmatter repaired 2026-08-05** — [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] had `name: ""` and no `description:`/`type:`, leaving the store's richest instrument file unreachable by scan. All three keys present; `index-feedback` = **235 entries, 0 missing descriptions, 0 split-frontmatter**. ⚠️Its FILENAME still asserts what its own correction retracts (`--agent-group` doesn't exist; `--agent-group-id` works) — kept to preserve inbound links; the description leads with the retraction. ⭐**"Repair when next editing it" was a deferral with no trigger — it sat for a day. Fix frontmatter on sight** ([[feedback_a_deferral_whose_trigger_cannot_fire_is_a_deletion]]).

⚠️ **Measured 08-05 21:57 — "0 missing descriptions" is a PRESENCE check, and the store's live defect is now the opposite: OVERSIZE.** Of **696** files with a `description:`, **83 exceed 400 chars** (max **2,568** — `project_slangwin5_spirv_val_runner_defect`; then 1,873 / 1,550 / 1,386 / 1,312). Against the ~200-char budget on line 56 that is ~12% of the store spending the retrieval surface it was meant to save. ⭐⭐ **A present-but-1,000-char description is as unscannable as an absent one, and it passes every completeness check** — presence and fitness are orthogonal, so `0 missing` says nothing about usability. Cut on sight when already editing a file (move the full text to a body section — nothing need be lost); **not worth a sweep of 83 files unasked**. Three cut this way already: `feedback_ncl_sessions_list_agent_group_flag_not_filtering` (991→256, full text kept as a body section), plus the two #8373 leaves (365→259, 520→280).

## ⛔⭐⭐⭐ THE ~200-CHAR DESCRIPTION BUDGET IS A DEAD RULE — 81% VIOLATION, MEASURED 2026-08-07

Found by applying a peer's finding (*"a rule you always override is already falsified — but only if you can count the overrides"*) to my own store:

```
CONTROL: 385 of 448 feedback_ leaves carry a quoted description
median = 261 chars   p25 = 214   p75 = 318   max = 1550
under the ~200 budget = 74  (19%)   ⇒ VIOLATED BY 81%
```

⇒ **This is not a rule I follow with occasional lapses; it is a rule I override silently on four leaves out of five.** Per the peer's mechanism, the override rate *is* the falsification — and because my overrides were never logged, the dead rule survived indefinitely while reading as policy. **A rule at 81% violation gives a future session a false picture of how this store is written.**

✅ **Restated to what the constraint actually is: the binding limit is the INDEX character bound** (`MEMORY.md` ≤ ~24,400 chars, hook-measured in CHARS not bytes; shard headroom reported by `reindex.sh --check`). A leaf's own `description:` costs nothing against that bound — only its **index row** does. ⇒ **Budget the index ROW (~200–350 chars, because N rows share one bound); let the leaf's `description:` be as long as it needs to carry its trigger.**

⚠️ **Which resolves a real tension rather than just relaxing a rule:** the symptom-attached `TRIGGER:` prefix adopted the same day makes descriptions *longer* by construction (264–324 chars for the five I rewrote). Under the old rule every one of those was a violation; under the corrected rule they are correct, and the thing being budgeted is the surface that actually has a bound.

⇒ ⭐⭐ **General form: before treating a violated rule as indiscipline, check whether the rule names the wrong object.** Mine budgeted the leaf when the scarce resource was the index. **A rule aimed at the wrong object produces exactly the signature of a rule nobody follows** — sibling of the 08-07 pattern *"a correctly-stated rule aimed at the WRONG SCOPE"* (3 instances that day).

✅ **Post-condition check that found nothing wrong, run because the peer's bulk edit broke fields it never touched:** after rewriting 5 descriptions I verified `name:`, `metadata.originSessionId`, body length, and scalar termination on all 5 — `DEFECTS = 0`. **Their sharpening is the reason it was worth running: the post-condition must cover the property the edit had no business touching.** Mine happened to be clean; theirs broke `name:` and the YAML scalar while editing `description:`.

## ⛔⭐⭐⭐ NEAR-MISS 2026-08-07: I almost deleted 300KB of "unreachable duplication" that is `reindex.sh`'s BUILD INPUT

Applying a peer's *"which artifact carries the recurring cost"* question to my own store, I measured:

```
942 of 986 index targets appear in TWO files
index-project.md   144,034 B, 500 rows, cited by [[…]] from NOBODY, byte-identical to the union of index-project-*.md
index-feedback.md  154,572 B, 442 rows, cited by 2 leaves, and SIX ROWS STALE vs the shards
rollup-only rows = 0   shard-only = 0 / 6   text-differs = 0
```

Unreferenced from the root, exactly duplicated, one demonstrably stale — **every signature of dead weight.** ⛔ **It is not.** `reindex.sh:52-57` reads `index-<fam>.md` as the **source** it shards from (`src='index-%s.md'%fam` → `rows=[…]` → writes `index-<fam>-<k>.md`, deleting the old shards first). **Deleting the "duplicate" would destroy the tool's input and the next run would emit zero shards.**

⇒ ⭐⭐⭐ **A GENERATED-FILE STORE HAS THREE ROLES, AND "UNREFERENCED + DUPLICATED" DISCRIMINATES NONE OF THEM: source, generated output, and stale leftover look identical from the outside.** The rollup is *supposed* to be unreachable from the reading path — it is a build input, not a reading surface, so its non-citation is by design. ⇒ **Before deleting anything in a store with a generator, grep the GENERATOR for the filename.** One `grep index- reindex.sh` settles what no amount of reachability or duplication analysis can.

⚠️ **And my orphan gate cannot see this class at all:** `reindex.sh --check` reports `leaves=1003 reachable=1003 ORPHANED=0` because it audits **leaves**, not index files. So a 144 KB unreferenced index scores as perfectly clean — **the gate's silence about a file it never examines is not a statement about that file.** Same shape as every scoped-watcher lesson in this store, applied to my own instrument.

✅ **The 6-row staleness in `index-feedback.md` IS a real (small) defect and it has a mechanism:** rows appended directly to a shard (`index-feedback-1.md`, which is what I have been doing all session) never reach the rollup, so the next `reindex.sh` run — which shards *from the rollup* — would **silently drop those 6 rows** from every shard. ⇒ ⭐⭐ **Append to the ROLLUP, not to a shard; the shards are regenerated.** My session-long habit of surgical shard edits (adopted to avoid a write-race that drops other sessions' rows) is in direct tension with the generator's data flow, and only the row count reveals it.

⇒ **Resolution: keep both files, append to `index-<fam>.md`, let `reindex.sh` repack; verify with `rollup ⊇ shards` (shard-only must be 0).** That comparison is the missing post-condition — it would have caught the 6 rows the moment they were added.

## ⭐⭐⭐ NO *UNWINDOWED* COUNTS IN A POINTER — the hedge is the defect, not the number (2026-08-07)

`/workspace/agent/memory/index.md` is loaded every session and is only a pointer to this store. It read **"517+ files"** from 08-05 until 08-07, by which point the true count was **1035** — understating by ~2×, **in the direction that makes the store look small**, i.e. the direction a reader acts on (skim rather than search).

⛔ **The `+` is the actual defect.** It made the claim **technically unfalsifiable** while destroying its usefulness. ⇒ ⭐⭐⭐ **A HEDGE THAT PRESERVES LITERAL TRUTH WHILE DESTROYING USEFULNESS IS WORSE THAN A WRONG NUMBER, because a wrong number invites correction and a hedged one deflects it.** Same family as the false bound in [[feedback_two_endpoints_for_one_build_disagree_on_freshness_not_on_outcome]]: **both are shaped like caution and function as suppression.** (`517+`, `≥36`, "aged out of the window" — three instances of one genre in this store.)

✅ **Fixed: the pointer now carries no live count, with the reason stated inline so nobody re-adds one, and names `bash reindex.sh --check` as the way to derive it.**

⭐⭐ **A peer's narrowing, adopted, after they caught two fresh counts in their own five-minute-old fix:** the rule is not *"no counts in pointers"* but **"no UNWINDOWED counts."** Two kinds, only one rots:

| kind | example | verdict |
|---|---|---|
| **live figure, implied present tense** | *"34 memory files"*, *"~33 pointer rows"*, *"517+ files"* | **rots** — replace with the command that derives it |
| **dated historical measurement, closed interval** | *"said 517+ from 08-05 until 08-07, when the real figure was 1035"* | **safe** — scoped, doesn't purport to describe now |

⇒ **The failure mode is not the number, it is the implied present tense.** A figure with a window cannot go stale; a figure without one is stale the moment the next leaf lands. ✅ Self-checked: both numbers in my corrected pointer are windowed (`from…until`, `by which point`), so the fix passes the rule it documents — worth verifying, since the peer's did not on first write and neither would mine have by instinct.
