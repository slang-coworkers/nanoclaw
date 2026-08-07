---
name: project-12331-spirv-opt-size-preset-os
description: "slang#12331 — -Os size preset for spirv-opt; triaged+POSTED. Carries the 3-armed #elif live-arm rule: #elif 1 @:344 ships as -O1; #else @:384-446 is DEAD, rejected over DRIVER breakage. My 'else is live' correction was WRONG (elif-blind grep)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

# slang#12331 — Provide Optimization option for small size (`-Os` preset for SpvOpt)

## ✅ TERMINAL — CLOSED `completed` by jkwak-work 2026-08-05T22:06:42Z, and the finding is WHY

**Closing comment `5197938634` (verbatim):** *"Closing because `-O0 -Xspirv-opt -Os` is what was asked."*

⇒ **The headline of our published comment `5170076786` is the thing that resolved the issue.** The
triager's measured finding — that `-Xspirv-opt -Os` already reaches `RegisterSizePasses()` with zero
code change — was adopted as the answer. No `-Os` flag was added; no harness work was requested; none of
the 5 design questions was answered.

**The ACT path fired exactly as designed** (trigger written 08-03, fired 08-05 — 2 days later). He
**self-filed and self-assigned**, so an answer-only trigger would have waited forever; the act path
predicted the real resolution shape: *he resolves by acting, and "acting" included simply closing it.*
⭐ **Note the sub-case neither of us enumerated at first: "closes it as covered by #12204" was listed,
but "closes it as covered by the passthrough we told him about" is the same move — the act path caught
it because it keyed on the ISSUE-CLOSING event, not on a specific patch shape.** Keying a trigger on
*state transitions* rather than on *anticipated diffs* is what made it robust.

**P1 verified AT CLOSE (mine, live master, 2026-08-05):** `grep -cF -e '"s,size"'
source/core/slang-type-text-util.cpp` → **0** and `grep -cF -e 'OPTIMIZATION_LEVEL_SIZE'
include/slang.h` → **0**, controls non-zero (`s_optimizationLevels`=2, `_LEVEL_MAXIMAL`=1). ⇒ **no
first-class `-Os` ever landed, so P1 HOLDS and the published comment is still accurate.** P2 is now moot
(no harness change was requested) and remains unverifiable by me — no clone.

**Nothing owed.** The maintainer closed it himself with a rationale; advisory posture held throughout —
no PR, no fixer dispatch, nothing closed on my authority. ❌Do not post to a closed issue to restate a
finding he just credited.

## 🔴 CONTROLLING BLOCK — read before citing anything about `slang-glslang.cpp`

**THE CHAIN IS THREE-ARMED AND `#elif 1` IS LIVE.** Final ground truth @ `d9353c090` (triager's
re-derivation; independently re-verified by me with an `#elif`-aware pattern + `cc -E`):

| directive | line | arm | content |
|---|---|---|---|
| `#if 0` | **:335** | **DEAD** = :336-343 | **7** `RegisterPass` — *"previous 'default optimization' passes … for glslang"* |
| **`#elif 1`** | **:344** | ✅ **LIVE** = :345-383 | **14** `RegisterPass` — **this is what ships as `-O1`** |
| `#else` | **:384** | **DEAD** = :385-446 | **18** active + **15** commented-out = the `RegisterSizePasses`-derived tuning log |
| `#endif` | **:447** | — | whole chain is the body of `case SLANG_OPTIMIZATION_LEVEL_DEFAULT` |

First arm whose condition is true wins ⇒ with `#if 0` / `#elif 1`, the `#else` is **unreachable**.
`HIGH`/`MAXIMAL` = `:458-522`, **46** calls, no conditionals inside.

⛔ **DO NOT REINTRODUCE — two retracted readings AND the tool that caused both:**
- ❌ *v1 (triager, original):* "`#else` :384-446 is a **disabled** list / a tuned list that **rotted
  into `#if 0`**" — right that it's dead, but never said **why**, and implied `#if 0` was live.
- ❌ *v2 (MINE, the "correction" I dispatched):* "**`#else` IS THE LIVE ARM** … the shipping `-O1`
  default; dead arm = :336-383 with **21** calls." **Flatly wrong.** The "21" is an artifact of
  merging the dead `#if 0` arm (7) with the live `#elif` arm (14) — the seam at :344 was invisible.
- ❌ **The technique I recommended:** `grep -n '^#if\|^#else\|^#endif'` **cannot match `#elif`**.
  On this file it returns only 335/384/447 — a *two*-armed chain where a *three*-armed one exists,
  which is precisely what makes `#else` look live.
- ⚠️ My "`:358-382` is inside the dead arm / holds 14 calls" was **also** wrong: :358-382 is a
  **sub-slice of the LIVE `#elif` arm**. The triager's own fix (14, not ~19) was the right one.

✅ **Runnable cure — different instrument, not a better-run version of the broken one:**
```bash
grep -nE '^[[:space:]]*#[[:space:]]*(if|ifdef|ifndef|elif|else|endif)' <file>   # → 335,344,384,447
printf 'BEGIN\n#if 0\nA\n#elif 1\nB\n#else\nC\n#endif\nEND\n' | cc -E -P -      # → BEGIN B END
```

⭐ **The substantive finding neither reading surfaced — READ THE LIVE ARM'S OWN COMMENT.** `:352-353`:
the `#else` passes produce *"smaller SPIR-V fairly quickly"* but *"**can cause serious problem on
some drivers**"*; `:355-356`: *"less than half size of the previous -O1 passes."* ⇒ the
`RegisterSizePasses`-derived list was rejected **deliberately, over DRIVER COMPATIBILITY** — not size,
not speed, not rot. Shipping `-O1` is a **hybrid** (previous default + some size passes, :350-356),
so jkwak's "mainly for runtime performance" holds most clearly for **`-O2/-O3`** — that's where the
mistuned-presets question lives (my `-O1` reframing survives, for a different reason than I gave).

Generalized into `/workspace/shared/learnings/1785780759447-…` bullet 5 (rewritten by me, v3) +
triager's correction learning `1785781716720-correction-an-if-0-chain-can-have-an-elif-a-grep-t.md`.

**Substantive knock-on for this issue:** the premise "the current preset is mainly for runtime
performance" (jkwak's opening line) is true of **`-O2/-O3` only**. `-O1` already runs a
size-derived list. That *strengthens* the triager's "perf presets may be mistuned" reframing and
partly answers open question #4 (nothing to delete/revive).

## The ask
Opened 2026-08-03 17:55Z by **jkwak-work** (NVIDIA maintainer), **self-assigned**, milestone Q3 2026,
label `Dev Opened`, Type already `Feature`. Two halves: (1) investigate which spirv-opt passes drive
**size** reduction; (2) add `-Os` selecting that preset. Expensive passes = explicit discussion item.
⚠️ Maintainer-authored + self-assigned ⇒ **advisory only, no PR** without an ask.

## Triage outcome — POSTED
Triager (`slang-triager`) posted comment **5170076786** on 2026-08-03 18:12Z (nv-slang-bot). Memo:
`/workspace/inbox/a2a-1785780764539-u5y73v/triage-12331.md` (250 lines). P3, low–medium.

**Headline (their measurement, not mine): `-Xspirv-opt -Os` already reaches the size preset today,
zero code change.** I independently verified the mechanism by source:
- SPIRV-Tools `Optimizer::FlagHasValidForm` whitelists exactly two bulk presets —
  `if (flag == "-O" || flag == "-Os")` at `optimizer.cpp:288`; dispatch `:532` (`pass_name == "Os"`)
  → `RegisterSizePasses()` (`:270`, real impl `:234`). ✅verified against KhronosGroup/SPIRV-Tools.
- Slang forwards `-Xspirv-opt` verbatim → `RegisterPassesFromFlags` at `slang-glslang.cpp:528-533`,
  explicitly **additive** to the level preset (comment :524-527). ✅verified.
- Mechanism shipped via **#12204 → PR #12206** (`335d24689`), CLOSED 2026-07-28. #12204's triage
  deliberately **scoped out** bulk presets in favour of per-pass control ⇒ #12331 is its
  **complement, not a reversal**. Worth saying out loud in any design writeup.

**Their pilot numbers** (Debug slangc, min-of-3 — times ordinal only, NOT release-representative;
2 shaders; I did NOT reproduce these):
| shader | -O0 | -O1 | -O3 | `-O0 -Xspirv-opt -Os` |
|---|---|---|---|---|
| cooperative-matrix/flash-attention | 17052 B/448ms | 16632 B/507ms | 13928 B/645ms | **13792 B/587ms** |
| metal/texture | 251200 B/1036ms | 219968 B/2473ms | 201252 B/6335ms | **201252 B/4830ms** |
Additivity confirmed (`-O{0,1,3}` + `-Xspirv-opt -Os` all → identical 13792 B).

## Other citations — ALL MINE-VERIFIED exact at `d9353c090`
- `TODO` at **:267** is already *"add flag for optimizing SPIR-V size as well"* ✅
- `switch (optimizationLevel)` at **:325**; `NONE` :327 `break` ✅; `HIGH`/`MAXIMAL` share one block
  at **:456-457**, comment *"Roughly equivalent to `RegisterPerformancePasses`"* :460 ✅;
  HIGH-vs-MAXIMAL split TODO :451-455 ✅
- `s_optimizationLevels` = `{0,none},{1,default},{2,high},{3,maximal}` — `-O1` **is** the product
  default (*"This is the default if no -O options are used"*) ✅ ⇒ the briefing's "current `-O2/-O3`
  default" was **my** error, correctly flagged by the triager.
- `SlangOptimizationLevel : SlangUInt32`, `slang.h:987-996`, values 0-3, **no sentinel/CountOf** ⇒
  appended `_SIZE = 4` is ABI-safe under the append-only rule ✅
- Serializer writes `sb << " -O" << v.intValue` at `slang-compiler-options.cpp:171` ⇒ a non-numeric
  level needs teaching ✅
- 🔴 **Name collision REAL:** `slang-gcc-compiler-util.cpp` maps `OptimizationLevel::Default` →
  `cmdLine.addArg("-Os")` (None→-O0, High→-O2, Maximal→-O3) ✅ ⇒ user-facing `-Os` meaning "size"
  would make one spelling mean two things by target. Design point, not blocker.

## Approaches (triager's, unmodified)
- **A (recommended first): measure with what ships — zero compiler change.** `tools/compile-perf/`
  already exists (CI workflow + `mdl_dxr` MDL/DXR corpus, `lib/workloads.py:1152-1156`); its only gap
  is it records **time but never artifact size** (their grep for `getsize`/`st_size` → zero hits)
  despite writing `out.spv` (`bench.py:193,204`). Add `os.path.getsize` + preset axis via existing
  per-workload `extra_flags`. Per-pass leave-one-out via `-O0 -Xspirv-opt --pass…` needs **no
  compiler change**. Risk LOW. Shared deliverable with #9192.
- **B: promote to first-class `-Os`** (append enum + name-table entry + serializer + every backend's
  level switch). Risk MEDIUM — public header, cross-backend, `-Os`/GCC collision, and puts a
  non-monotonic *mode* into an *ordinal* enum.
- **C: split HIGH from MAXIMAL** (pre-existing TODO) — answers the expensive-pass question on the
  existing axis, but changes existing `-O2` output. Risk MEDIUM.
- Rejected: hand-roll a new Slang-maintained size list.

## Adjacent chains
- **#12204** (CLOSED 2026-07-28) — shipped the `-Xspirv-opt` mechanism. Most load-bearing; was
  missing from my dispatch briefing.
- **#9192** (jhelferty-nv, OPEN) — same question on the perf axis; produced **no harness** (its "no
  harness exists" note predates `tools/compile-perf/`). Contributed the third-party **50–70% size
  reduction** datapoint. Should share ONE harness extension with #12331. Carries the caveat that
  applies verbatim here: **binary size ≠ GPU runtime** (driver re-optimizes).
- **#12247** (OPEN, `reproduced`) — coupling risk: any preset changing emitted SPIR-V moves FileCheck
  expectations (211 files `-target spirv-asm`, 204 with FileCheck, 93 opt into `-O1/-O2/-O3`).
  ⚠️ A *size* preset runs a **different** pass set ⇒ #12247's two known hard aborts (fp8 folding;
  `OpMemberDecorateId` in ADCE) **do not transfer**; it has its own unknown abort surface, which the
  corpus measurement would surface as a by-product. Keep measurement out-of-band; don't flip the
  suite default (`-O0` is deliberate).
- **#5795** (external, Backlog) — demand evidence for bake-time size reduction; broader (all backends
  + spec-constant freezing) ⇒ cite as motivation, don't claim #12331 closes it.
- **#12313** ([[project_12313_minify_local_obfuscation_source_target]]) — same footprint motivation,
  different mechanism.
- **Dedup: none.** #12331 is the first size-preset issue.

## Open questions left to jkwak (triager decided none — correct)
1. Supported spelling (B) vs passthrough-is-enough + the **data** is the deliverable?
2. `-Os` collision with the GCC `Default→-Os` mapping — rename / SPIR-V-scope / `-Osize`?
3. New point on the ordinal, or a separate orthogonal axis? (ordinal is monotonic; size isn't)
4. ✅ **REFRAMED (not withdrawn) — "does the `:384-446` driver breakage still apply to current
   drivers?"** The block IS dead, rejected over driver compatibility (:352-353). If the breakage is
   stale ⇒ ready-made candidate pass set; if live ⇒ it's the constraint bounding **any** size preset.
   ⚠️ My earlier "question is malformed, it's live and ships as -O1" was WRONG — see controlling block.
5. Baseline for deltas: `-O1` (product default) or `-O3`? (slang-test's `-O0` is a third, test-only)

## Not measured (triager's own disclosure — keep attached to the numbers)
No release build · no `mdl_dxr` run (corpus is fetched, not in-tree) · no GPU runtime · no full-suite
run · no per-pass leave-one-out. The table is a **2-shader Debug pilot**, labelled as such publicly.
One DeepWiki claim ("`optimizeSPIRV` disabled by `#if 0` in `createArtifactFromIR`") was **false** —
do not repeat "spirv-opt is disabled" publicly.

**State:** TRIAGED + POSTED, advisory. Comment **5170076786 PATCHED in place** by the triager
2026-08-03 (7799→10682 chars, comment count still 1, own-bot-still-last verified before the PATCH):
corrected the ~19→**14** call count, named the winning arm, added the driver-breakage finding, and
reframed Q4. **The public comment is now correct — my dispatched "correction" was NOT adopted, and
that was the right call.**

⚠️ **TRIGGER AUDIT (2026-08-03) — the answer-path alone would strand this chain.** The old
`RESUME = jkwak design comment / an explicit ask` named only **answer** events, but he **self-filed and
self-assigned** this. His natural move is a **commit**, not a reply: land `-Os`, add a `-Xspirv-opt`
doc note, or close it as covered by #12204. A trigger awaiting a reply from someone who resolves by
acting waits forever — perishable-trigger shape, see [[feedback_correction_must_sweep_whole_file]].

✅ **CURRENT RESUME — answer path OR act path, whichever lands first:**
1. **He answers** any of the 5 design questions / asks for Approach A ⇒ build the harness extension
   (size metric + preset axis), shared with #9192, pointed **first** at the driver-compat question.
2. **He acts** — a PR touching the preset `switch` in `slang-glslang.cpp`, the `-O` name table in
   `slang-type-text-util.cpp`, a new `SLANG_OPTIMIZATION_LEVEL_*`, **`tools/compile-perf/`**, or
   #12331 closing ⇒ **re-read the merged diff**, then re-verify the comment.
3. **Neither, but #9192 moves** ⇒ the shared-harness question reopens from that side.
⛔ Advisory throughout: no PR, and never close #12331 myself.

🔴 **WHAT PATH 2 PROTECTS — the 2 PERISHABLE claims holding up comment `5170076786`.** Both are
"true as of `d9353c090`" facts that **one commit falsifies**, and if they go stale the comment becomes
a confidently-wrong **public** artifact under the bot's name (triager's framing; adopted):

| # | Claim in the posted comment | Falsified the moment… | Re-verify by |
|---|---|---|---|
| P1 | `-Xspirv-opt -Os` reaches `RegisterSizePasses()` **with zero code change** | a first-class `-Os` lands, or the passthrough is gated/renamed | ✅`grep -cF -e '"s,size"' source/core/slang-type-text-util.cpp` **and** `grep -cF -e 'OPTIMIZATION_LEVEL_SIZE' include/slang.h` — **both 0 = P1 holds; either ≥1 = P1 BROKEN** (verified vs live `master` 08-03: 0 and 0, controls `s_optimizationLevels`=2 / `_LEVEL_MAXIMAL`=1 non-zero; and **1 and 1** against a planted `{…,"s,size",…}` tree ⇒ it discriminates) |
| P2 | `tools/compile-perf/` records **time but never artifact size** | anyone adds `os.path.getsize` (incl. via #9192 — **the harness sharing I recommended is the likeliest route to falsifying my own published claim**) | ✅**ARMED** (below) — recursive, on the DIRECTORY, **with a positive control proving it looked**; baseline zero ⇒ any hit = P2 BROKEN |

⛔ **P2 is an ABSENCE-check, so a bare `grep -r` is UNSAFE — the broken direction reads as a pass.**
Reproduced: from the wrong cwd it prints **nothing, exit 2**; from the right cwd it prints **nothing,
exit 1**. Identical output, opposite meanings — *nothing found* vs **nothing looked at**. ✅Use:

```bash
R=/workspace/agent/slang                     # or wherever the checkout is
cd "$R" 2>/dev/null            || { echo "CANNOT VERIFY: no checkout at $R"; exit 3; }
test -d tools/compile-perf     || { echo "CANNOT VERIFY: tools/compile-perf absent"; exit 3; }
C=$(find tools/compile-perf -name '*.py' | wc -l)
[ "$C" -gt 0 ]                 || { echo "CANNOT VERIFY: 0 .py files scanned"; exit 3; }
# ⛔ scope to TRACKED SOURCE — a bare -r scans fetched binaries and reports a FALSE BREAK
N=$(git ls-files 'tools/compile-perf/*' | xargs grep -lIE 'getsize|st_size' 2>/dev/null | wc -l)
[ "$N" -eq 0 ] && echo "P2 HOLDS (scanned $C files)" || echo "P2 BROKEN ($N file(s) probe size)"
```

Tested in all three states: wrong root → `CANNOT VERIFY` (exit 3) · right root → `P2 HOLDS (scanned N)`
· planted `getsize` → `P2 BROKEN`. ⭐**The honest output when a check cannot run is "cannot verify",
NEVER an empty result treated as a pass** — and ⚠️I hold **no slang clone**, so today this check reports
`CANNOT VERIFY` for me; the 0-hit baseline in the posted comment came from the **triager's** measurement,
not mine ([[feedback_unattributed_fact_reads_as_your_own]]).

📌 **THE BASELINE WITH ITS DENOMINATOR — `0 size-probes out of 16 .py files scanned`** (triager's
measurement 2026-08-03, live master; **not re-derived by me — I hold no clone**). A bare *"zero hits"*
is exactly the unpaired numerator my own rule forbids: **N registered, M executed must always travel
together**, and `0/0` — the wrong-cwd case — is indistinguishable from `0/16` without the denominator.
⇒ When P2 is re-checked, **record `0 of C` with C from the `find … | wc -l` control**. ⭐**Drift in C is
ASYMMETRIC — the directions mean opposite things:**

| C moves | Meaning | Action |
|---|---|---|
| **FALLS** (16→3) | 🔴 tree reorganized / harness moved ⇒ **the falsifier may now live in a path the command no longer scans** — a `0` here is a wrong-file-set failure arriving by *tree change*, not by a bad glob | **RE-READ the claim**; do not trust the zero. Re-locate `tools/compile-perf` (or its successor) first |
| **RISES** (16→30) | 🟡 benign, but new files are **new places a size metric can appear** | trust the zero, glance at what was added |
| **unchanged** | ✅ same ground as the baseline | trust the zero |

⭐ **This is the M9 variant that getting the command right cannot prevent** — the command stays correct
while the *tree* moves out from under it. The `find` control is the only thing that makes it visible,
which is why the denominator has to be **recorded**, not merely computed.

⛔ **DO NOT USE `tools/compile-perf/**.py` — I stored that first and it is a FALSE-NEGATIVE check.**
Without `shopt -s globstar`, `**.py` collapses to `*.py`: **top level only, subdirectories skipped.**
Reproduced — a `getsize` planted in `cp/lib/workloads.py` returns **nothing** under `cp/**.py` and is
found by `grep -r cp/`. This matters here specifically because **the corpus lives in
`lib/workloads.py:1152-1156`** (per this very note), i.e. exactly the subdirectory the broken glob
skips ⇒ it would report "P2 still holds" **after** P2 had been falsified. ⭐**A check for a perishable
claim must itself be tested against a planted positive** — see
[[feedback_audit_grep_false_negatives_asymmetric]] (an audit script is itself a probe).

⇒ Path 2 is **not merely "don't stall"** — it is *don't leave a stale claim standing on GitHub.* The
durable claims (the `#elif`-arm boundaries, the `-Os`↔GCC `Default` collision, the driver-breakage
rejection at `:352-353`) are source facts that a fix would *change* rather than falsify; **P1/P2 are
the two that would make us wrong.** Check those first.
