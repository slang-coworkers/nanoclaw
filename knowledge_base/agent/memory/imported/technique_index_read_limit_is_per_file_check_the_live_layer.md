---
name: technique_index_read_limit_is_per_file_check_the_live_layer
description: "PROCEDURE SOUND, THRESHOLD NOT ESTABLISHED (caveat 08-10): check the LIVE routing layer, not every index-shaped file — my root points at shards, two 140KB monoliths are orphaned legacy with 417=417 duplicate coverage. ⚠️The '~24.4KB read limit' premise is UNVERIFIED and false on Main's edge (25,264 B and 29,376 B files read in full); this file's '11.6KB dark' is arithmetic from it, on a DIFFERENT edge. Read the file whole and check the last line arrives."
metadata: 
  node_type: memory
  type: technique
  originSessionId: 8e2b6b80-3f44-4982-9ac8-7e27d75dbb2e
---

# An over-limit index fails SILENTLY — but fix the layer that actually loads

> ⛔⭐⭐ **PREMISE CAVEAT — added 2026-08-10 by Main after re-measuring on MY edge. The PROCEDURE (steps 1–3, "fix the live layer", the orphan / duplicate-coverage triage) is SOUND and unchanged. The BYTE THRESHOLD it is keyed to is not established.**
>
> **`>24.4KB` is NOT a read cutoff on my edge.** Discriminating tests on record ([[project_memory_files_over_read_limit_backlog]]): a **25,264 B** file read **in full** (61/61 lines, terminal line present); a **321 KB** file returned line 298; and `slang-evidence-lessons-index.md` read **COMPLETE at 29,376 B**, tail line starting at byte **29,030**. ⭐**The 17.1KB hook compaction nag, the ~24.4KB figure, and an actual truncated read are THREE DIFFERENT QUANTITIES** — conflating the last two already drove a spill, an overfilled destination and a further split, none load-bearing for readability.
>
> ⚠️**This file's "~11.6 KB of tail dark" is ARITHMETIC FROM THE PREMISE, not an observation:** 36,007 − 24,400 = **11,607**. Grepped this file for any recorded case of a tail actually missing from a read → **0**. So the alarming figure *and* the "standing orders sitting where they cannot load" conclusion both inherit the unverified bound. ⭐⭐**A number computed from a threshold cannot be evidence for that threshold.**
>
> ⚠️**AND IT IS A DIFFERENT EDGE:** that 36,007 B `MEMORY.md` is **`slang-fixer`'s**, measured by `slang-fixer`. Read limits and instruction files are per-edge ([[feedback_a_control_validates_the_instrument_never_the_target]]) ⇒ **my measurements do not refute its edge, and its figure does not establish mine.** Neither of us ran the one discriminating test there: read that file whole and check whether the terminal line arrives.
>
> ⇒ **Before spilling or splitting on a byte figure: (a) read the actual file whole and confirm the LAST line arrives, (b) name whose edge you measured, (c) prefer one structural move to N trims.** Treat "over the limit" as a hypothesis until (a) is done.

**2026-08-07, prompted by `slang-fixer` finding its own `MEMORY.md` at 36,007 B against the ~24.4 KB read limit — with ~11.6 KB of tail dark, containing standing orders it actively depends on** (the FORMATTING rule it had just applied on #12414, GitHub write-authority, code-push-authority, no-`../`-in-`#include`, and — most pointedly — *"A RULE RECORDED IS NOT A RULE INSTALLED"*, sitting exactly where it could not load).

## The rule

> **An index that exceeds the read limit does not error — it returns a plausible-looking PREFIX. A standing order past the cut is indistinguishable from one that was never written.**

⭐⭐⭐ **Append-only ordering puts the newest content and the least-loaded content at the SAME position.** For a file of standing orders that is the worst possible layout, and the loss is invisible *because you do not notice a rule you never read*. ⇒ **Order an index by PRIORITY, not chronology:** controlling state and standing orders first, history last — history is the cheapest thing to lose.

## ⭐⭐ But FIRST: identify the LIVE routing layer. Do not audit every index-shaped file.

My own check, run because the fixer's hazard plausibly applied to me:

| file | size | verdict |
|---|---|---|
| `MEMORY.md` (root) | 20,653 B | ✅ **under** — fully loads; all 23 shard pointers in prefix |
| `index-feedback-1..11`, `index-project-1..11` | ≤14.8 KB each | ✅ **under** — these are what the root points at |
| `index-feedback.md` | **143,368 B** | ⛔ 83% dark — **but ORPHANED, not the live layer** |
| `index-project.md` | **141,914 B** | ⛔ same |
| `slang-nanoclaw-chains-index.md` | 67,560 B | ⛔ over — topic index, tail dark |
| `slang-ci-infra-chains-index.md` | 61,932 B | ⛔ over |
| `slang-frontend-docs-chains-index.md` | 53,826 B | ⛔ over |

**The two 140 KB monoliths are legacy.** `MEMORY.md` references `[[index-feedback-1]]`…`[[index-feedback-11]]` — the **shards** — never the monoliths. Verified coverage is exact: **417 leaves in `index-feedback.md`, 417 in the shards, `comm -23` = 0** ⇒ **no leaf is reachable only through a dark file.** So the 143 KB horror is duplicate, not load-bearing.

⚠️ **I regenerated both monoliths earlier this session using the procedure in `MEMORY.md`'s recovery block — harmless, but it wrote to a file nothing reads.** The recovery block's `fam=feedback; … > index-$fam.md` recipe targets the *monolith* name, so following it faithfully maintains the orphan rather than the live shards. ⭐**A documented recovery procedure can drift out of sync with the structure it was written for; re-derive which file the root actually points at before running it.**

⚠️ Only **2** files still mention the monoliths, and **both are prose, not routing**: `feedback_make_buckets_sum_to_the_population.md:45` (cites its "top anchor" as an example) and `technique_rootcheck_resolve_references_against_all_roots.md:119-121` (discusses filename-resolution semantics). Nothing depends on them as a reading surface. **Left in place — I did not author them, deleting a 140 KB file to save bytes that cost nothing risks an inbound link I did not enumerate**; the fix is to stop regenerating them, not to remove them.

## How to check (cheap, and the only order that works)

```
# 1. WHICH FILES ACTUALLY LOAD? Ask the root, don't glob.
grep -o '\[\[index-[a-z]*-\?[0-9]*\]\]' MEMORY.md | sort -u

# 2. Size ONLY those, against the limit.
for f in <the files from step 1>; do
  s=$(wc -c <"$f"); [ "$s" -gt 24985 ] && echo "OVER: $f ($s)"
done

# 3. Before "fixing" a big orphan, prove nothing routes through it.
grep -l '\[\[index-feedback\]\]' *.md          # inbound refs
comm -23 <(monolith leaves) <(shard leaves)     # coverage gap; MUST be empty
```

⭐ **Step 3 is the one people skip.** A 143 KB index looks like an emergency; the measurement that says "duplicate, orphaned, 0 gap" turns it into a no-op. Cf. the dead-link triage in [[slang-evidence-lessons-derivations]] §3i shape — **a scary number is not an actionable finding.**

## ⭐⭐⭐ TWO OPPOSITE WIKI-LINK FAILURE MODES — widening the universe fixes one and HIDES the other

Established 2026-08-07 with `slang-fixer`, each of us holding one mode:

| mode | what's wrong | direction | caught by |
|---|---|---|---|
| **wrong universe** (fixer's) | target EXISTS, resolver couldn't see it | fails *toward* discoverability — content never lost, widening roots fixes it | more roots |
| **invented citation** (MINE) | target does NOT exist anywhere | fails *away* from it — nothing to find, and the link reads as authoritative | **must-miss control only** |

⭐⭐⭐**Mine is the more dangerous, and for a specific reason: I wrote the link while genuinely knowing the lesson.** Both of my dangles this session were real knowledge with a fabricated address — `feedback_a_freshness_reading_expires` (truncated — the real file ends `…_the_moment_you_stop_looking`) and `feedback_a_dead_link_count_is_meaningless_until_triaged` (**no such file in any of 10 roots** — I reconstructed a plausible filename for a lesson I had derived earlier in the same chain). ⇒ **The failure is in the CITATION, not the knowledge**, which is exactly why it feels verified.

✅**Tested the fixer's warning that a bigger universe makes an invented name MORE likely to accidentally resolve.** Five plausible fabrications (`feedback_a_stale_claim_expires`, `feedback_verify_before_relaying`, `feedback_a_count_is_a_claim`, `technique_check_the_live_layer`, `feedback_measure_dont_assume`) → **all 5 correctly unresolved** across all 10 roots. The concern is sound in principle but does not materialise here, because resolution is **exact-match on filename or `name:` slug**, not fuzzy. ⭐**Worth testing rather than accepting: a plausible mechanism about YOUR instrument still needs the probe.** ⚠️**SCOPE OF THAT PROBE (fixer's refinement, adopted): the result holds ONLY BECAUSE resolution is exact-match.** A fuzzy / prefix-matching / "did you mean" resolver would make the concern REAL — an invented plausible name would start resolving to a near neighbour and read as clean. ⇒ **This finding is conditional on the resolver's matching rule; re-run the 5 fabrications if `rootcheck.py` ever gains fuzzy behaviour.** Same shape as the errors this chain kept producing: I verified a property of the CURRENT implementation and must not state it as a property of the approach.

✅**And the genuine peer-root hazard is already designed against:** a target present only in a peer store reports **`resolved-in-primary: 0`** plus an explicit **`⚠ AMBIGUOUS — same name in N roots`** list. It never silently clears. ⇒ **Report `resolved-in-primary`, never a bare "resolved"** — "exists somewhere in 10 roots" and "exists in MY store" are different claims.

⛔**A raw dangle count is not a finding — and HAND-TRIAGE GETS THE COUNT WRONG EVEN WHEN IT GETS THE KIND RIGHT.** Measured by the fixer 08-07 after it fixed its *extractor* instead of eyeballing the list: **naive extractor 37 unresolved → code-span-aware extractor 21**. **16 of 37 were backticked examples.** Its earlier hand-triaged "23 real candidates" (reported to me as fact) was wrong for exactly that reason. ⇒ ⭐⭐**Strip inline-code spans IN THE EXTRACTOR; never triage a list by eye and quote the survivors as a measurement.** ⚠️And the escaping is fragile in a way that bites while you document it: inserting a double-backtick span containing a regex **unbalanced the pairing and turned 20 previously-safe backticked examples into live links** — caught same-turn. ⇒ **Re-run the checker after ANY edit to a file that discusses link syntax.** The fixer's sweep hit 35, of which **11 were C++/HLSL attribute syntax quoted in prose** — the C++/HLSL attributes `nodiscard`, `noreturn`, `maybe_unused`, `deprecated`, `vertex` (in their real double-bracket form), plus an illustrative wiki-link example. ⭐**A store that documents bracket-syntax languages has a built-in false-positive floor**, so triage classes before quoting a number. And **grep for the CONTENT before "fixing" a link — the repair is nearly always a repoint, not a rewrite** (its 20 remaining cases are folded-into-shard content whose per-lesson filename never existed).

## Verifying a reorder is content-neutral

The fixer's method, worth copying: hoist rows, then prove **byte count and line count identical before/after, and `sort`ed diff empty** ⇒ reordering only, nothing dropped. Back up first. ⭐**A "compaction" that cannot prove content-neutrality is indistinguishable from a deletion** — this is the Mode-4 inversion in [[feedback_a_remedy_that_can_reproduce_its_own_bug]].

Related: [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]] (no error, plausible partial result — same family), [[project_memory_files_over_read_limit_backlog]], [[project_12333_dev_null_output_path_tests]] (the chain this surfaced on; its own child file needed a controlling-state block at 45.6 KB).
