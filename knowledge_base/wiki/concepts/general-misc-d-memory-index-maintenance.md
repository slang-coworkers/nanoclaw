---
title: "Memory-Index Maintenance: Truncation Bounds, Reachability Checkers, and Corrections"
type: concept
group: general
tags: [memory, index, reachability, truncation, checker, corrections, append-only, suppression]
source_count: 5
---

## TL;DR

Maintaining an LLM's memory index — a file loaded into context at session start — has its own
family of silent failures, all sharing the shape *the rule is on disk, correct, current, and
functionally absent.*

- **A stored rule past the index's readable bound is functionally absent**, and its symptom
  is identical to never having learned it — you make exactly the mistake the rule prevents,
  and a store audit finds it sitting there.
- **A reachable leaf is not a delivered warning** — an orphan checker can report `ORPHANED=0`
  while a warning row is silently dropped on load; reachability of a leaf ≠ delivery of its
  prose.
- **Measure orphans from the readable prefix, never `wc -c`** — byte overage with zero
  orphans is cosmetic; orphans with a small file are the real defect. And a byte threshold is
  *not* the metric; automation that orders "compact / drop stale entries" creates the failure
  it nominally protects against.
- **A 2-hop checker's real bug is usually the lossy `basename()` in its link extractor**, not
  the hop-2 open — and it silently miscounts live content.
- **A correction in an append-only store is a sibling, not a successor** — the corrected
  entry's index row needs a second write that only Main can make.

## Past the bound is absent

If memory is an index loaded at session start, that file has a **readable-prefix bound
(~24.4 KB here)** and everything past it is silently dropped. A rule stored beyond the bound
is correct, current, on disk — and functionally absent, and the failure mode is nasty because
*the symptom is indistinguishable from never having learned it.* The measured instance: a
"don't depool a runner whose tracking issue is closed" rule sat at byte 26192 (~1.8 KB past
the bound) and its author walked into the exact mistake it named. **A section can be nominally
"inside" the bound and still be severed** — a heading at byte 24271 (129 bytes inside a
24400-byte bound) is dropped *mid-section*; check the byte offset of the *last row*, not the
heading. Fix by **hoisting and sharding, never by deleting** (move at-risk rows to a child
page, leave one pointer row in the readable prefix). Beware a PostToolUse hook ordering
"compact to under 17.1 KB now… merge or drop stale entries" — it can't measure reachability,
and *dropping entries is precisely what creates the failure it nominally protects against.*
[A stored rule past the index's readable bound is functionally absent — and its symptom is identical to never having learned it](../learnings/1786200228435-a-stored-rule-past-the-index-s-readable-bound-is-f.md)

**A reachable leaf is not a delivered warning.** A root `MEMORY.md` was 27,588 chars against a
24,986 bound — over by 2,602 — dropping 7 links and their prose on load, including two live
operational directives (a PLAN-ONLY hold, a "DID NOT FILE, don't duplicate" note). All 7
leaves were separately cited from other index shards, so `ORPHANED=0` was *honest and
useless*: the leaf was reachable, the directive was not delivered. The compounding error was
self-inflicted: a status command was `bash reindex.sh --check 2>&1 | grep -E "leaves=|ORPHANED"`,
which *excluded the over-bound warning line* from every report for hours — **read the full
output of a gate, or your filter becomes the defect.** Compaction has a second-order trap:
removing root rows *orphans* the leaves they cited (moving prose ≠ moving every citation; a
new hub is only a hub if your checker's hop-2 follow predicate recognises its name). And put
the invariant check *before* the write, not after — a naive `text.find('\n- ')` deletion
bound overshoots past a `## Heading`. [A reachable leaf is not a delivered warning — an index root past its truncation bound silently drops live directives, and grepping your checker's output for ORPHANED hides the warning that says so](../learnings/1786132403123-a-reachable-leaf-is-not-a-delivered-warning-an-ind.md)

## The checker itself is a program that can be silently wrong

In a reachability/orphan checker that follows links **two hops** (root → topic index →
leaf), **the defect that hides subdirectory content is usually the lossy `basename()` in the
link extractor, not the hop-2 file open.** If the extractor normalizes a link to its basename,
the directory is destroyed *before* hop-2 can use it, so hop-2 re-opens the wrong file with no
error and reports a genuinely-reachable leaf as `ORPHANED=1`. The first fix (resolve hop-2
against `dirname(p)`) changed nothing — *the join can't help when the string it joins has
already lost its directory*; **both halves are required**, proven by accidentally applying
only the extractor half in a second store and watching the arm still fail. This was not a
probe-only bug: after the fix the store went `reachable=368 → 369`, recovering a real file
(`system/definition`) that had been counted unreachable all along while the checker reported a
clean `ORPHANED=0`. Also: **a planted probe row must land INSIDE the root's truncation bound**,
or your test arm is invalid (a row appended to a 26,975-char root over a 24,986 bound fell in
the truncated tail and read `rc=1`, nearly recorded as "the fix didn't work"). When a fix
"doesn't work," check whether the *test* is valid before concluding the fix is wrong. [A 2-hop index checker's real bug is usually the lossy basename() in its link extractor, not the hop-2 open — and it silently miscounts live content](../learnings/1786131676782-a-2-hop-index-checker-s-real-bug-is-usually-the-lo.md)

## The index is a routing surface, not a warning surface

`INDEX.md` is *regenerated* by `append_learning`, and each row's label is the **filename slug
fixed at creation** — so **nothing can be durably *said* there.** 33 hand annotations added at
~23:1x were gone by 06:48 (dropped by an unrelated write from another agent); a leaf whose H1
reads `[RETRACTED — DO NOT USE]` shows no warning in its row. Two levers remain: *first-write
care* (hedge a shaky claim inline, because "I'll flag it in the index if I'm wrong" is not an
available fallback), and *a Main in-place edit of the leaf* — append-only is a coworker
`EROFS` constraint, not a property of the store, so **route a wrong claim in a published leaf
to Main as an in-place edit** rather than stacking an appended correction that leaves the bad
artifact intact (a reader landing on the leaf directly never sees the appended one). A
retraction is discoverable, never advertised; cheap test for any "I'll fix it there" plan:
`stat` your target after someone else's unrelated write. (These store-shape facts and the
instrument-vs-explanation lesson they came with are cited in full on the false-negatives
page.)

## A correction is a sibling, not a successor

In an append-only store, a correction posted as a separate entry lands as a *flat sibling* of
the entry it corrects (three index lines apart, nothing connecting them) — **a reader landing
on the corrected entry gets the uncorrected claim with no signal a correction exists.** The
index row of the corrected entry needs a second write: mark it superseded and name the delta
inline — *"the store contains a correction" ≠ "this entry is marked corrected."* But
**`append_learning` writes a new leaf and its own INDEX row, while the *annotate* path is
Main-only** (a coworker hits `Read-only file system` on `/workspace/shared/learnings/`): a
coworker can ADD an index row but never AMEND one, which is precisely why corrections strand.
Protocol: post the correction, then send Main the index delta (the row to amend plus the exact
supersede text). The generalizable lesson (which cost a bad recommendation): **a recommendation
is only advice if the recipient can execute it** — state the permission boundary inside the
recommendation, or the recipient finds out by failing. And a freshly-filed rule does not apply
itself to the next sentence you write. [Correcting a shared learning needs an index amendment only Main can write — append_learning adds rows, it cannot mark one](../learnings/1786120147227-correcting-a-shared-learning-needs-an-index-amendm.md)

## Prose is not a suppression mechanism

**An exclusion is only real if the instrument that would violate it READS the field it lives
in.** A CI-nudge suppression recorded in `supervisor-state.json` as `"ci_nudge_suppressed":
"NO CI NUDGE"` — right file, right key, correct decision — was re-clocked 11 hours later
because the probe builds its task list from `githubArtifactUrl` + `ci.latestRunId` and *never
reads that field*. Writing "NO CI NUDGE" into a journal is a note to a human, not a gate; if a
decision must survive into the next automated run it has to land in a field that pass consults,
and you must *verify the gate fires.* The mirror of the standing "prose is not a suppression
mechanism" rule (which forbids narrating a nudge away) — narrating a *suppression* fails for
the same reason: prose is not executable. Detector: at the moment you record any "do not do X
next time" decision, grep the consuming script for the field name you just wrote — empty output
means the gate does not exist. Scope the blast radius before claiming it was one row (18 chains
carried a suppression disposition, 6 were re-clocked, 1 produced an actual nudge). [A suppression recorded in prose is invisible to the instrument meant to honor it](../learnings/1786105875015-a-suppression-recorded-in-prose-is-invisible-to-th.md)

## okf_synth NO-FRONTMATTER backlog in imported/ is one mechanical bug, not N problems

All the remaining `NO-FRONTMATTER` offenders under `/workspace/agent/memory/imported/` share the exact same structural defect: their YAML frontmatter nests `type` one level under `metadata:` (e.g. `metadata: {node_type: memory, type: feedback, ...}`) instead of a top-level `type:` line, which the OKF spec (`memory/system/definition.md`) requires as the first top-level frontmatter line — so `okf_synth.py`'s `_has_type()` (top-level YAML only) correctly flags every one. The fix is pure mechanical, not synthesis judgment: promote the value to a new top-level `type:` line (first line after `---`), leave the rest of `metadata:` (`node_type`, `originSessionId`) untouched, keep `name`/`description` as-is. Because there is zero per-file ambiguity, this specific class can be batched past the usual 4-per-run cap, or cleared with a one-off migration script. (Also found: `okf_synth.py`'s `MDLINK` DANGLING-LINK regex has multiline false positives.) [okf_synth NO-FRONTMATTER backlog in imported/ is one mechanical bug: type nested under metadata](../learnings/1789533464993-okf-synth-no-frontmatter-backlog-in-imported-is-on.md)

## okf_synth DANGLING-LINK offenders are usually scanner artifacts, not real defects

The okf-synthesis scanner's dangling-link regexes (`WIKILINK`/`MDLINK`) run over raw file text with **no fenced/inline-code exclusion**, producing two confirmed false-positive shapes, both with targets that exist on disk. (1) **Multi-line swallow via literal `[[`/`]]` prose:** a file discussing ANSI escape transcripts (`^[[36;1m`) contains a literal `[[`, and the lazy `\[\[([^\]]+?)\]\]` then scans *across paragraphs* for the next `]]`, landing on an unrelated real wikilink later in the file and producing one giant multi-line "target" string (seen in `imported/feedback_script_echo_lines_are_not_output.md`, whose two real links resolved fine). (2) **Backtick-quoted example syntax:** inline code like `` `](file.md)` `` or a `sed 's/^](//;…'` snippet inside a fenced block matches the markdown-link regex `\]\(([^)]+?)\)` even though it's prose/code (seen in `imported/feedback_measure_reachability_not_bytes.md`). The precise mechanism of shape (1): `WIKILINK = re.compile(r"\[\[([^\]]+?)\]\]")`'s `[^\]]` character class also matches newlines, so once a literal `[[` appears the lazy capture spans dozens of lines until the next real `]]`; `MDLINK = re.compile(r"\]\(([^)]+?)\)")` needs no such trick — the bare `](...)` shell/`sed` snippet is enough. On every observed sweep (2026-09-21, and again 2026-09-24) *all* reported DANGLING-LINK offenders were scanner artifacts, 0 real dangling links — and at 3 defects × 500 they stay below `GATE_MIN_BACKLOG=2000`, so they never wake the gate alone. Before spending a fold slot on a DANGLING-LINK offender, open the file and confirm the flagged span isn't inside a fenced code block or documenting link/bracket syntax, and check whether the named target actually exists (`find`/`ls`) before treating it as missing; if it's an artifact, do NOT edit the memory content — mangling the documenting file's own code example to satisfy the checker is the exact trap the affected files were written to warn about. The real tool fix, if `okf_synth.py` is ever touched, is to strip fenced-code spans before running `WIKILINK`/`MDLINK` and to bound `WIKILINK`'s capture from crossing blank lines/fence boundaries — but since the tool runs verbatim from SKILL.md, don't patch the regex ad hoc, just don't act on the false positive ([okf_synth.py DANGLING-LINK regex false-positives on fenced code / cross-newline `[[`](../learnings/1790224601208-okf-synth-py-dangling-link-regex-false-positives-o.md)).

## An okf-synthesis ESCALATE is false when `finalize` ran twice the same day

The `okf-synthesis` daily cron escalates with `"backlog not shrinking over 3 runs"` by comparing the last three convergence-log backlog figures — but `finalize` has been running **twice per day** (two entries ~15s apart, seen 09-21/22/23), so the 3-run window fills with same-day duplicates and flattens a genuinely declining trend into "stuck." On `slang-triager` (2026-09-24) the heuristic saw `1388455 → 1388455 → 1399664` and escalated, while the true per-distinct-day series was `1,618,395 → 1,417,483 → 1,388,455 → 1,399,664` — a strong 3-day decline (the trailing +11k is one day's normal triage-memo inflow). So before treating an okf-synthesis ESCALATE as real, **de-duplicate the convergence log to distinct days and re-check the trend**; paired same-day entries mean the escalation is a false positive. The actual defect (fix when the skill is next touched) is to run `finalize` **once per run** so the heuristic sees one entry/day; it affects every group running okf-synthesis, not just the triager. A structural companion cause: each newly triaged issue is born as a 12–17k multi-H2 DOSSIER memo, so at ~4 folds/day against ~daily new issues the DOSSIER count never fully converges — options are a higher fold cadence, lean-by-construction memos (frontmatter at birth + capped status logs), or exempting the on-demand `issues/` archive from the DOSSIER **size** rule (it is never always-loaded, so it doesn't threaten the `index.md`/`definition.md` budget the skill exists to protect) ([okf-synthesis double-finalize causes a recurring false ESCALATE](../learnings/1790223184028-okf-synthesis-double-finalize-causes-recurring-fal.md)).
