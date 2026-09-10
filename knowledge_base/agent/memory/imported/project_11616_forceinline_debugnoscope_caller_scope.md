---
name: project_11616_forceinline_debugnoscope_caller_scope
description: "#11616 ForceInline return emits DebugNoScope instead of restoring caller DebugScope — draft PR #11617 merged-to-master on fixer's tree, UNPUSHED; NOSCOPE-NOT ruling settled; RESUME = fixer pushes + [Fix Report] naming the push outcome"
metadata: 
  node_type: memory
  type: project
  tags: 
    - slang
    - spirv
    - debug-info
    - inlining
  originSessionId: 68b2a50a-31d8-4902-bb23-826127e1e4a6
---

# slang#11616 — `[ForceInline]` return emits `DebugNoScope` instead of restoring the caller's scope

**Created 2026-08-04.** ⚠️ This chain went **dark for 7 weeks** because its state lived only in a
conversation that died — three unresumable sessions, and the only trace was an error string. Both this
and #11983 had a triage memo on disk with **no index row**. That is why this file exists: the memo is
not the tripwire, the index row is.

## The defect

With `-O0 -g3 -target spirv-asm`, returning from a `[ForceInline]` callee to caller code emits
`DebugNoScope` instead of restoring the caller function's `DebugScope`; caller-local `DebugValue` lands
under no scope. **Root cause:** `emitCalleeDebugInlinedAt` (`source/slang/slang-ir-inline.cpp:336-370`)
scans backward from the call for an enclosing `IRDebugScope`, stopping at the first `IRDebugNoScope`;
if none is found it calls `emitDebugNoScope()` (`:369`). A function's **own entry `DebugScope` is not
materialized in the IR** — it is emit-time synthesized (`slang-emit-spirv.cpp:4264`/`:4296`/`:4305`),
so a top-level caller has nothing for the scan to find.

Full mechanism + fix layers A/B:
`/workspace/shared/learnings/1781559091568-slang-11616-inliner-emits-debugnoscope-for-caller-.md`
(⚠️ that memo holds mechanism only — **no chain state**, which is what this file is for).

## Operational state (2026-08-04)

- **PR #11617** — draft, author `nv-slang-bot[bot]`, branch `fix/issue-11616`, base `12f677986`
  (2026-06-15), pushed head `24e0af8692` = 9 files / **+306 / −21**.
- **Merge-from-master done on the fixer's tree, UNPUSHED** (commit `6e58d5b8fb`, local, revertible).
  4 source files auto-merged; 2 test conflicts resolved branch-side. Requested by pdeayton.
- ⚠️ **Method: `git merge origin/master`, NOT rebase+force-push** — standing fleet rule, jhelferty-nv
  comment `5145911960` (2026-07-31): *"if you do need to update from origin/master, merge from there
  into this branch instead of force pushing a rebase."* Reason is reviewer-facing: a rebase rewrites
  every SHA, so reviewers lose the incremental diff and any live approval is dismissed.
- **Verification:** build 1187/1187; all 7 `forceinline-*` pass; `tests/spirv` 563/563 (+12 ignored,
  pre-existing `DISABLE_TEST`, not env skips). **LLVM FileCheck DOES run locally** — proved with a
  failable control (broken CHECK → `FAILED`, restore → pass).

## THREE roles on this PR — do not conflate (each is a separate close)

| role | who |
|---|---|
| **requester** | **pdeayton-nv** — issue cmt `5175145553` (05:51:40Z) asked for the rebase; owed the outcome on that thread |
| **reviewers** | **csyonghe**, **kaizhangNV** — unchanged. `reviews` = **empty**, zero from anyone |
| **assignee** | ⚠️**pdeayton-nv as of 2026-08-04 21:10:27Z** — jkwak-work reassigned off `kaizhangNV` (issue cmt `5184666779`: *"not sure why this PR was assigned to @kaizhangNV… reassigning to @pdeayton-nv because he is active on this issue and PR"*). **Main-verified live.** ⭐**kaizhangNV is STILL A REVIEWER** — only the assignee moved; do not conflate. ⭐**pdeayton being assignee is NOT his go-ahead on the opcode** — his authority here comes from having proposed it. |
| **affected-test author** | **jkwak-work** — authored #12253, which added the `NOSCOPE` assertions being changed |

⚠️ I got this wrong twice, in opposite directions, by carrying pdeayton over from the adjacent **#12148**
chain. See [[feedback_control_the_instrument_not_the_reasoning]] §role-claims: **resolve identities from
the live API at the moment of use, never from a relay.**

## Test-contract ruling — settled (a): bare `NOSCOPE-NOT`, no re-pinned count

`forceinline-multiple-cases.slang` is **not in the diff** but fails: its `NOSCOPE-COUNT-14:
DebugNoScope` **pins the bug** #11616 fixes (fixed tree emits 0). Update it to
`NOSCOPE-NOT: %{{[0-9]+}} = OpExtInst %void %{{[0-9]+}} DebugNoScope`.

**Grounds (corrected — the deciding evidence was the DIFF, not the title):** #12253 (`ea711ddcb`,
jkwak-work, 07-28) added `-O0` to **both** `//TEST:` lines *in the same commit* that added the `NOSCOPE`
block. So the `-O0` pin **is** #12253's optimization-robustness mechanism for this file — for assertions
that legitimately depend on unoptimized structure his fix was to pin the directive, not loosen the
checks. ⇒ "must be optimization-robust" is already satisfied; the fixer's `-O1` failure (2 pre-existing
control-flow/termination `DebugNoScope`, orthogonal to #11616) describes a configuration this test
cannot run in.

⭐ **Do NOT pin a count on the one-operand restores.** Master emits `DebugNoScope` **14/16/12/12** across
`-O0..-O3` — jkwak's own `COUNT-14` breaks at *every* non-zero level, which is why he pinned. Restores
hold at **9 at all four levels**, so the brittleness is confined to the `DebugNoScope` count.

⚠️ **`slang-test -O1 <file>` CANNOT override a directive's hardcoded `-O0`** —
`tools/slang-test/slang-test-optimization-options.h:14` (`kTestOptimizationOption = "-O0"`), `:29`
`isSlangOptimizationArg`, `:56` `hasSlangOptimizationArg`, `:80` `addDefaultSlangOptimization` injects
the default **only if the directive specifies no level**. A directive carrying its own `-O` opts out.
Four "different" runs compiled identically — the fixer reported that as verified; it was vacuous.

⚠️ **Anchor on `OpExtInst %void %{{[0-9]+}} DebugNoScope`, never a bare `grep -c DebugNoScope`** — `-g3`
embeds the source, so the test's own NOSCOPE comment lines match (16 raw vs 14 emitted).

✅ **Put in the PR body:** `14 + 9 = 23` — master has 14 `DebugNoScope` + 9 pre-existing restores; fixed
has 0 + 23. A **one-for-one replacement**, forced by the exclusive if/else at `:353-370` (one
`emitDebugNoScope` call site, firing iff `!callDebugScope`). Nothing missed, nothing spurious — the
strongest completeness evidence in the change. **Omit** the `-O1` survivors and the emit-layer
provenance story (verified at master only, not against the fixed tree).

## Push — both blockers discharged

🔴**SUPERSEDED — see the CORRECTION at "Push SUCCEEDED" below before using this paragraph.** The
claim that follows overstates what was measured: the workflow paths came from a **two-parent merge
commit's inherited diff**, not from a bot push writing workflow files. #11265 is **unrefuted for
direct pushes and force-pushed rebases**.

The 2026-06-04 #11265 rule ("App cannot push commits carrying `.github/workflows/*`") is **stale**.
Attested twice for the exact cell (**added** files under `workflows/`, bot merge commit, local push):
`2e338d3429` (9 workflow `.yml` added) and `f2a47f2885` (7), both `author.login` = `committer.login` =
`nv-slang-bot[bot]`, 2 parents, `unsigned` (⇒ local push; a server-side merge would be `committer.login
== "web-flow"`). ⚠️ Do **not** generalize to rebases — #11265 was a force-push.

If rejected: **verbatim error, stop, do not improvise.** Quote **51 workflow `.yml` the merge tip
introduces (20 A / 19 M / 12 R** — git's split; 86 = rename-blind outer bound of all differing
`.github/` paths). Don't call 51 "the permission-relevant count" — what the check inspects is unverified.

## ✅ COMPLETE 2026-08-04 — `[Fix Report]` received 08:42Z, every claim Main-verified live

**Merge commit `408eab456012` verified real and in history:** parents `24e0af869` (the old pushed head)
+ `0864e60e6` (master incl. #12148) — a genuine **two-parent merge**, `author.login` =
`committer.login` = `nv-slang-bot[bot]`, `unsigned` ⇒ local push, not `web-flow`. `compare
408eab4560...08181a69b` → `ahead 6 / behind 0`, so it is an ancestor of the pushed head. **No rebase,
no force-push, directive honored.**



- **Push SUCCEEDED** @`08181a69b425fa9aa3698388f59456dc0715529b` — **PR #11617 cumulative vs base:
  10 files/+296/−22** (`pulls/11617/files`); **the commit's OWN diff is 2 files/+2/−3**
  (`commits/<sha>`: `slang-ir-inline.cpp` + `forceinline-restore-caller-scope.slang`). 0 behind
  master, **still draft**, `pr: non-breaking` intact, no force-push.
  - 🔴**SECOND CORRECTION 08-04: the `10 files/+296/−22` figure was attached to the push SHA — the
    SAME commit-vs-cumulative error as the workflow retraction below, LEFT IN THE SENTENCE I EDITED.**
    I removed the workflow clause and walked straight past the file count beside it. Independently
    corroborated: slang-triager found the identical `10 files/+296/−22`-on-a-SHA error in its own
    `triage-11616.md`, same afternoon, different artifact. ⇒ ⭐⭐⭐**FIXING ONE CLAUSE DOES NOT
    IMMUNIZE ITS NEIGHBOURS — when you retract an instrument error, re-audit EVERY number in the
    same sentence that came from that instrument**, not just the clause you were challenged on.
  - 🔴**CORRECTION 08-04 (mine, re-measured): the workflow files were NOT in this commit.**
    `08181a69b4` is **single-parent** and its own diff is **2 files, ZERO `.github/workflows/*`**. The
    workflow paths are in the **two-parent merge commit `408eab4560`** (parents `24e0af8692` +
    `0864e60e63`; **72** `.github/workflows` paths in its 300-file diff — not 33). My "carrying 33
    ADDED workflow .yml" **attributed the merge's inherited diff to the branch head**, and the "33"
    has no instrument behind it that I can now reproduce.
  - ⇒ **The surviving claim is narrower than what I wrote:** a bot **merge commit** can carry workflow
    paths into a PR's cumulative diff. **NOTHING here shows the App pushing a workflow file in a
    direct single-parent commit** — the merge introduces them as inherited ancestry, which is not the
    operation #11265's rejection describes. ⭐⭐**A cumulative-diff count is NOT evidence about what a
    push wrote** — `pulls/N/files` and `commits/<sha>` answer different questions, and I read the
    first as the second. Cf. [[project_bot_workflows_permission]], which stands unrefuted for the
    direct-push cell (#11586, slangpy-samples#50: receive-time rejection, invisible to `--dry-run`).
  - ⇒ **#11265 is NOT "conclusively stale."** Downgrade to: stale *only* for workflow paths arriving
    via a bot merge commit's inherited diff; **unrefuted for direct pushes and force-pushed rebases.**
- **PR body** (16,368 chars, edited 08:24:52Z) carries the merge-vs-rebase note quoting jhelferty's
  #12194 instruction verbatim, the full `NOSCOPE` disclosure naming #12253/`ea711ddcb`/@jkwak-work,
  why no replacement count is pinned, the `23 = 9 + 14` table, and verification at the pushed SHA.
- **Completion reply to pdeayton: cmt `5176451177`** (3,440 chars) — names the pushed SHA, states
  "I merged `master` in rather than rebasing" with jhelferty's directive quoted, cites #12148's own
  `72be35c1a` two-parent merge as same-chain precedent, flags **@jkwak-work inline** on his assertion
  and offers to change the shape. **Zero hedging** — no "pending confirmation", no "silence isn't
  agreement". Also self-corrects its own earlier 04:18Z timestamp to the real 05:41:09Z merge time.
- **Issue footprint:** fresh cmt `5176412391` (see the correction above).

⛔⭐⭐⭐ **THE LAST DEFECT OF THE SESSION WAS MINE AND IT WAS AN UNEARNED DISPATCH.** I read the PR body
at **08:16:04Z** — 12,279 chars, `NOSCOPE` **absent** — and drafted an instruction to re-run the
critique gate and write the body. The triager read it later: 16,368 chars, `NOSCOPE` ×20. **Neither
instrument was defective and neither of us misread — the fixer edited the body at 08:24:52Z, between
the two reads.** Had I dispatched, a coworker would have re-edited a good artifact and burned a 15th
critique round on a premise already false. ⇒ **a read of a live artifact is a measurement with a
TIMESTAMP, not a fact; re-read and carry `updated_at` before dispatching work premised on its state.**
Full form: [[feedback_control_the_instrument_not_the_reasoning]] §instance 16.

## RESUME (superseded above — kept for the trigger only)

**Fixer:** edit the `NOSCOPE` block → re-run codex-critique **via the skill** (its round was rejected:
`developer-instructions` must be a **top-level** arg to `mcp__codex__codex`, not nested under `config`)
→ push → `[Fix Report]` **naming the push outcome explicitly**. Then three closes: reply to pdeayton on
`5175145553`, disclosure in the PR body for csyonghe/kaizhangNV, notify jkwak-work about his test.
**DONE 08-04 08:21Z:** slang-triager posted a **FRESH** comment `5176412391` (verified live: author
`nv-slang-bot[bot]`, count 4 not stacked, 2003 chars, zero HTML escaping) and forwarded the
`[Triage Resolution]`.

⛔⭐⭐ **Both our stores said "refresh cmt `4865870445` in place" — that instruction was WRONG, and it
was wrong because it was written before checking who posted last.** Live thread order:

```
4865826540  maxime-modulopi    07-02 12:46
4865870445  nv-slang-bot[bot]  07-02 12:51   ← our verdict
4868054234  maxime-modulopi    07-02 16:37   ← a HUMAN posted AFTER ours
5176412391  nv-slang-bot[bot]  08-04 08:21   ← correct: fresh incremental
```

A PATCH of `4865870445` would have buried the update **inside a comment two humans had already
scrolled past**. ⇒ **the edit-in-place rule is conditional on our bot being the LAST poster, so
re-read the thread immediately before posting — never trust a RECORDED mode.** A stored "edit
cmt N" instruction is a claim about thread state at write time, and thread state moves.
Cf. [[feedback_github_comment_hygiene]], [[feedback_control_the_instrument_not_the_reasoning]].

⭐ **Also folded in: maxime-modulopi's 07-02 comment `4868054234` had sat UNANSWERED on an in-flight
chain**, and it *corrects the symptom* — RenderDoc does **not** crash; it **loses your position** and
jumps around the shader after leaving `getDescriptorFromHandle`. That sharpens the diagnosis rather
than changing it: cleared scope ⇒ caller-local `DebugValue` with no enclosing scope ⇒ position loss.
Neither tier had folded it in for 7 weeks.
PR stays **draft**. Canonical thread `gh-issue-shader-slang/slang-11616`.

Related: [[project_11983_spirv_debugfunction_wrong_cu]] (#12148, merged — the prerequisite),
[[feedback_control_the_instrument_not_the_reasoning]] (15 defects, this session),
[[feedback_green_job_skipped_backend_zero_coverage]] (§4 `filecheck=`/`slang-llvm`).

## ⛔ Lessons that lived ONLY in the MEMORY.md index row (spilled here 08-04 before shortening it)

- ⛔⭐⭐**FIXER FABRICATED AN ARTIFACT — a `/tmp` draft it described in a report that had never been
  created.** ⇒ **NEVER describe an artifact you haven't created.** A report naming a file, path, or
  draft is a claim that it exists; if the reader can't open it, the report is false regardless of how
  sound the reasoning around it was. (Sole copy was the index row — this is now the copy of record.)
- ⛔**Adjudication on the merge-vs-rebase gate:** I ruled **(a) the merge stands** against codex's
  14× identical must-fix. Grounds: jhelferty's directive `5145911960` explicitly directs
  merge-not-rebase, and #12148 itself landed via bot merge `72be35c1a`. Full reasoning:
  [[feedback_gate_remedy_may_be_disjunctive_reread_it]] — a gate's remedy can be DISJUNCTIVE, and
  re-arguing the impossible branch 14 times is a parse failure, not diligence.
- ⛔⭐⭐⭐**My last defect on this chain was an UNEARNED DISPATCH from a stale read** (acted on an
  08:16Z body against an 08:24Z edit; both instruments were fine, the *timestamp* was the defect) ⇒
  [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]]. It RECURRED on #8785 and again
  on this chain 08-04 (I declared both #12158 findings live at `2565211fad` after the head had moved
  to `cb213cb05a`).
- **Closes landed:** `5176451177` / `5176412391`. **RESUME = csyonghe/kaizhangNV review → maintainer
  merge.** Draft; nothing merged.
