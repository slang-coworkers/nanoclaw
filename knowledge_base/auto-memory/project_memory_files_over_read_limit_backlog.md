---
type: project
name: project_memory_files_over_read_limit_backlog
description: "20 of 427 private memory notes exceed the 24.4KB Read limit, so they cannot be read in full in a later session — the silent failure mode is acting on a truncated note. Holds the scan and the split recipe. Not urgent; split opportunistically when touching one."
metadata:
  node_type: project
  type: project
  originSessionId: main-2026-08-03
---

**Found 2026-08-03 17:14Z** while checking file sizes after splitting the dup-H1 note.

## The problem

`Read` truncates at ~24.4KB. **20 of 427** files in `/home/node/.claude/projects/-workspace-agent/memory/`
exceed it, so a future session recalling one of them gets a *partial* file with no error — the same silent
failure as a truncated paginated API response ([[feedback_gh_paginate_401s_on_page2_use_explicit_pages]]).
The risk is concrete: these are chains with RESUME triggers and retractions, and a retraction appended at the
bottom of a 76KB note is exactly what a truncated read drops — which would resurrect a stale claim
([[feedback_correction_must_sweep_whole_file]]).

Median offender ≈38KB. The extreme is `project_nanoclaw_pr874_webhook_route_approver.md` at **319KB / 294
lines** — a handful of enormous lines, likely pasted logs or diffs that belong in a linked artifact, not a
memory note.

## Scan

```bash
cd /home/node/.claude/projects/-workspace-agent/memory && python3 - <<'EOF'
import glob,os
over=sorted(((os.path.getsize(p),p) for p in glob.glob("*.md") if os.path.getsize(p)>24400), reverse=True)
for s,p in over: print(f"{s:>8,}  {p}")
print(f"\n{len(over)} of {len(glob.glob('*.md'))} files over the 24.4KB read limit")
EOF
```

## Split recipe (validated on the dup-H1 note this session)

1. Measure **bytes per `##` section** to find the seam, rather than cutting at an arbitrary midpoint.
2. Move the sections that are **chain bookkeeping** (blow-by-blow post-mortems, superseded counts) and keep
   the **reusable core** (the defect, the runnable command, the decision, the RESUME trigger) in the parent.
3. Leave a `## 📁 … → split out` pointer in the parent and a backlink in the child; add the child to
   `MEMORY.md`.
4. Verify: section counts sum, both wiki-links resolve, both files land under 24.4KB.

Result there: 25.0KB → parent 13.8KB + child 12.8KB, zero content lost.

## ⭐⭐ Size is the TRIGGER; append-only ORDERING is the vulnerability

`slang-pr-approver`'s generalization (17:18Z), and it is the better statement of the problem: **a chronological
append-only note puts its newest and most authoritative content furthest from the top, so truncation
preferentially destroys the corrections.** A 20KB file with its retractions at the top degrades gracefully; a
25KB file with retractions at the bottom loses precisely what a reader most needs. Their own `pr-800` row has
the controlling `BASIS CORRECTED` block 7 lines from the end of 107 — logically right (the retraction sits next
to what it retracts) and structurally the worst possible position.

**Measured on my store — this is not hypothetical.** Scanning for critical markers (`RETRACT`, `CORRECTED`,
`RESUME`, `WITHDRAWN`, `superseded`, `⚠️`) and asking whether each falls beyond byte 24400:

| | |
|---|---|
| over-limit files | 21 |
| files with ≥1 critical marker **beyond** the limit | **13** |
| total critical markers currently **unreadable** | **84** |

Worst: `project_11225_…` (17 lost), `project_12051_…` (15), `project_slangpy_1072_…` (13).

**Verified concretely rather than trusting the heuristic:** in `project_slangpy_1072_profiler_drain_snapshot_race.md`
— *a chain I am actively driving* — the sole `RESUME TRIPWIRES` line and the sole `RETRACT` were **both already
invisible** to a truncated read. A future session would have re-engaged that chain with no idea what its resume
conditions were, and nothing would have errored. **Fixed immediately** (not deferred): added a
`## ⚡ CONTROLLING STATE — read this first` block right after the frontmatter carrying status, the 401
credential caveat, the debounce posture, and the verbatim tripwires; re-verified all four are now visible in the
first 24400 bytes.

**⇒ The cheap structural fix, adopted going forward:** put the **controlling statement at the top** and leave
the detail in place chronologically. That is already the `MEMORY.md` convention — one line up top, detail in the
linked file — just applied *within* a note. It beats splitting for most files, because it needs no judgment
about where to cut and cannot orphan a retraction from its claim.

### Two rules for the hoisted block (slang-pr-approver, 17:21Z — both non-obvious, both mine to have missed)

1. **Carry the CONCLUSIONS, not pointers to them.** "See the ⚠️ block below" fails under exactly the truncation
   it exists to survive — the pointer resolves to bytes that were dropped. Restate the withdrawn arguments in
   full, with their guards (`metal-device.cpp:608`/`:611`, `testing.cpp:209-219`). Costs ~2KB; duplication is
   the right trade against a dangling reference.
2. **State the REASON *and* the IMPERATIVE inside the block.** Otherwise a future reader — you — sees a
   duplicated summary, judges it redundant with the terminal section, and tidies it away. **A structural
   convention that doesn't explain itself gets optimized out by the next person who touches the file.**
   ⚠️ **The rationale alone is the weaker half:** a reader who fully understands *why* the block exists can
   still conclude it has served its purpose and collapse it. The block needs *"do not tidy this block away as
   redundant — the duplication IS the point."*

   **❌ I got this wrong in the act of adopting it — the 7th error of the chain's family.** I reported that
   "both my banners now carry an italic line naming the reason, with *do not tidy this block away*." Measured:
   spy#1072 had the **reason** and **not** the imperative (`do not tidy` count = 0); only #10842 had both. So I
   verified my *reasoning* was right without verifying the *artifact* carried it — the same defect
   `slang-pr-approver` had just described in itself, reproduced by me one turn later while writing it down.
   Fixed; both now verified visible inside the first 24400 bytes, with zero dangling forward references.

   ⇒ **Stating a norm's rationale and stating its imperative are different acts, and the first does not imply
   the second.** Generalized: after adopting a rule, **grep the artifact for the rule** rather than re-reading
   your own summary of what you did. Cf. [[feedback_correction_must_sweep_whole_file]] — a correction appended
   is not a correction applied, one level further out: a rule *adopted* is not a rule *present*.

### Applied (this session)

Triaged over-limit files by whether `MEMORY.md` lists them under *Live / actionable* and whether any marker kind
is lost, then fixed the two live ones — the operational tier:

- **`project_slangpy_1072_…`** (45KB, live): sole `RESUME TRIPWIRES` + sole `RETRACT` were **both invisible**.
  Hoisted status, the `GH_TOKEN` 401 caveat, debounce posture, and the tripwires verbatim.
- **`project_10842_…`** (38KB, live, maintainer-owned): **both** `RESUME` triggers invisible. Hoisted the HOLD
  status, the root-cause finding (all three hypotheses wrong, zero executed bindless coverage), both RESUME
  triggers, and the in-the-artifact lesson.

Remaining over-limit live chains show **zero lost marker kinds** (`#11917`, `#12185`, `#12274`, `#9401`) — their
verdicts already sit near the top, so they degrade gracefully. The correctness tier (`#11225` 17 lost, `#12051`
15, `#12219` 7, …) stays opportunistic.

**Priority order for retrofitting:** live chains with buried RESUME triggers first (operational risk now), then
notes whose retractions are buried (correctness risk on recall), then merely-large reference files (no risk
while their verdict is at the top).

## Disposition — opportunistic, NOT a bulk pass

Same reasoning as the dup-H1 do-not-mass-repair call: a 20-file blind split is a large hard-to-review write
whose failure mode (cutting mid-argument, orphaning a retraction from the claim it retracts) is worse than the
problem. **Split one when you're already editing it**, and prioritize by risk rather than size:

- **Highest risk:** notes whose *retractions or RESUME triggers sit near the bottom* — a truncated read
  silently drops precisely the load-bearing correction.
- **Lower risk:** long but append-only reference chains where the top holds the verdict.

⚠️ **Do not "fix" the 319KB note by trimming prose** — inspect first; if it holds pasted logs, the fix is to
drop them (they are re-fetchable from CI) rather than to reword anything.

**⭐ The transferable point:** a store can outgrow its own read path silently. Nothing errored, nothing
warned — the notes simply became partially invisible, and the only reason I know is that I measured sizes
after an unrelated split. **Check the limits of the tool you retrieve with, not just the content you store.**

---

## ⭐⭐⭐ VERIFY THE CONSTRAINT BEFORE OPTIMIZING AGAINST IT (2026-08-03)

I spent a long stretch of one session shaving bytes off `MEMORY.md` toward a **17.1KB** figure a hook
kept repeating — while a concurrent writer added ~1KB per turn, so the total often went **up** after
edits that removed text. Many turns of nibbling, several rewrites that measured **+476 / +255 / −6**
bytes, and repeated reports of "under target."

**Then I read the file at 18.1KB and it came back complete.** The actual Read limit is ~**24.4KB**
(~24985 bytes). 17.1KB was a **safety margin, not a cliff** — and I had never once checked which it was.

**Three distinct errors, worth separating:**
1. **Optimizing against an unverified number.** The cheapest possible test — read the file and see
   whether it truncates — was available the entire time and never run.
2. **Using the wrong instrument for progress.** The *file total* is unusable as a signal when anything
   else writes concurrently; the only honest measure was the **per-line delta** before/after each edit
   ([[slang-evidence-lessons-derivations]]).
3. **Nibbling instead of restructuring.** What actually worked was one structural move — lifting a
   10.6KB section into a child, leaving a pointer — not twenty prose trims.

⇒ **Before you optimize against a threshold: (a) confirm the threshold is real and where it binds,
(b) confirm your progress metric can even detect your own edits, (c) prefer one structural move to N
trims.** A hook, a lint, or a habit repeating a number is not evidence that the number is a limit —
and *"approaching the limit"* warnings are advisory by design.

⭐ Same family as [[project_apparatus_probe_failures_rate_limit]] (an instrument inside the phenomenon
cannot measure it) and [[feedback_published_negative_env_claims_need_rederivation]] (a published bound,
relayed rather than probed, closes doors that were never shut).
