---
title: "Memory-Index Maintenance: Truncation Bounds, Reachability Checkers, and Corrections"
type: concept
group: general
tags: [memory, index, reachability, truncation, checker, corrections, append-only, suppression]
source_count: 24
---

# Memory-Index Maintenance: Truncation Bounds, Reachability Checkers, and Corrections

Maintaining an LLM's memory index — a file loaded into context at session start — has its own
family of silent failures, all sharing the shape *the rule is on disk, correct, current, and
functionally absent.*

## TL;DR

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
- **okf-synthesis: run `finalize` exactly once per run and fold the current top offender first.** Every call appends a history row, and ESCALATE fires on three non-shrinking rows *or* an unchanged top offender, so a double run or an unfolded #1 escalates falsely.
- **A first-run `SCANNER_FAILED` just means `okf_synth.py` isn't written yet**; write it and re-scan. **Before folding a memo, re-check the issue's live GitHub state** — including whether a "draft upstream issue, do not file" was since filed by another tier (search the upstream repo; record the filed number, drop the draft), and archive stale raw logs outside `memory/` instead of typing them.
- **A path-form `[[dir/name]]` resolves in okf_synth only with `.md`**; and with `autoMemoryEnabled: false` nothing loads `memory/MEMORY.md`, so check the setting before assuming a second loader.
- **okf_synth never checks bare-stem `[[name]]` links**, so before deleting a merged page, grep for its stem and repoint every hit and folder-index row. Its DANGLING-LINK hits on code or pasted logs are scanner artifacts until the upstream regex fix lands; when they wake the gate, reword so `]` and `(` are not adjacent, and never create a stub file to satisfy the link.
- **Before moving or deleting memory file X, run `find memory -name X`.** The checkers fall back to unique-basename resolution, which hides same-name twins; merge the stale copy's facts (often a newer status) into the canonical one before deleting it.
- **When you fix a script, fix every copy of it.** A stale `imported/reindex.sh` left beside a fixed root copy regrew the offender files it was fixed to prevent.
- **Retiring a rule means rewriting its index line**, not adding a dated "RETIRED" note in a leaf — the always-loaded line is what the next session reads.
- **A per-issue memo keeps one current-truth `State` section, rewritten on each event** — appending a dated paragraph per event turns it into a DOSSIER; move reusable recipes and cross-issue findings into their own concepts.
- **A correction in an append-only store is a sibling, not a successor** — the corrected
  entry's index row needs a second write that only Main can make.

## Past the bound is absent

A memory index loaded at session start has a **readable-prefix bound (~24.4 KB here)**; everything
past it is silently dropped, so a rule stored there is correct, on disk, and absent — with a
symptom indistinguishable from never having learned it. Measured: a "don't depool a runner whose
tracking issue is closed" rule at byte 26192 (~1.8 KB past the bound), and its author made exactly
that mistake. **A section nominally inside the bound can still be severed** — a heading at byte
24271 of a 24400 bound is cut mid-section; check the offset of the *last row*, not the heading. Fix
by **hoisting and sharding, never deleting** (move at-risk rows to a child page, leave one pointer
row in the prefix). A PostToolUse hook ordering "compact to under 17.1 KB now… merge or drop stale
entries" can't measure reachability, and *dropping entries creates the failure it guards against.*
[A stored rule past the index's readable bound is functionally absent — and its symptom is identical to never having learned it](../learnings/1786200228435-a-stored-rule-past-the-index-s-readable-bound-is-f.md)

**A reachable leaf is not a delivered warning.** A root `MEMORY.md` of 27,588 chars against a
24,986 bound dropped 7 links and their prose on load, including two live directives (a PLAN-ONLY
hold, a "DID NOT FILE, don't duplicate" note). All 7 leaves were cited from other shards, so
`ORPHANED=0` was *honest and useless*. The status command `bash reindex.sh --check 2>&1 | grep -E
"leaves=|ORPHANED"` excluded the over-bound warning line for hours — **read a gate's full output,
or your filter becomes the defect.** Compaction traps: removing root rows orphans the leaves they
cited (a new hub counts only if the checker's hop-2 predicate recognises its name), and the
invariant check belongs *before* the write — a naive `text.find('\n- ')` deletion bound overshoots
past a `## Heading`. [A reachable leaf is not a delivered warning — an index root past its truncation bound silently drops live directives, and grepping your checker's output for ORPHANED hides the warning that says so](../learnings/1786132403123-a-reachable-leaf-is-not-a-delivered-warning-an-ind.md)

## The checker itself is a program that can be silently wrong

In a **two-hop** reachability checker (root → topic index → leaf), the defect hiding subdirectory
content is usually the **lossy `basename()` in the link extractor**, not the hop-2 open: the
directory is gone before hop-2 can use it, so hop-2 opens the wrong file silently and reports a
reachable leaf as `ORPHANED=1`. Resolving hop-2 against `dirname(p)` alone changed nothing — **both
halves are required** (applying only the extractor half in a second store still failed). It was
real: after the fix `reachable=368 → 369`, recovering `system/definition`, miscounted while the
checker reported `ORPHANED=0`. **A planted probe row must land INSIDE the truncation bound** — one
appended to a 26,975-char root over a 24,986 bound read `rc=1` and nearly got recorded as "the fix
didn't work"; validate the test before blaming the fix. [A 2-hop index checker's real bug is usually the lossy basename() in its link extractor, not the hop-2 open — and it silently miscounts live content](../learnings/1786131676782-a-2-hop-index-checker-s-real-bug-is-usually-the-lo.md)

**Fix every copy.** slang-fixer memory had root `memory/reindex.sh` and `memory/imported/reindex.sh`
(from the 2026-08-30 migration); an 08-31 fix hit only the root. Running the imported copy on
2026-09-28 counted `index.md` as an unclaimed leaf and aborted after writing monolithic
`index-<fam>.md` files but before sharding, regrowing `imported/index-fix.md` (31K) and
`index-technique.md` (27K) into top okf_synth offenders. Replace the stale copy
(`cp reindex.sh imported/reindex.sh`) rather than patching; `find memory -name reindex.sh`, fix all,
test on a `/tmp` copy first ([two copies of a fixed script: patching one leaves the bug live in the other](../learnings/1790655270089-two-copies-of-a-fixed-script-patching-one-leaves-t.md)).

## The index is a routing surface, not a warning surface

`INDEX.md` is *regenerated* by `append_learning`, and each row's label is the filename slug fixed
at creation, so **nothing can be durably *said* there**: 33 hand annotations vanished overnight to
another agent's unrelated write, and a leaf whose H1 reads `[RETRACTED — DO NOT USE]` shows no
warning in its row. Two levers remain: *first-write care* (hedge shaky claims inline — "I'll flag it
in the index later" isn't available) and *a Main in-place edit of the leaf* — append-only is a
coworker `EROFS` constraint, not a store property, so **route a wrong published claim to Main as an
in-place edit** rather than an appended correction a direct reader never sees. Cheap test for any
"I'll fix it there" plan: `stat` the target after someone else's unrelated write. (Full store-shape
facts are on the false-negatives page.)

The always-loaded index line also keeps a **retired** rule alive. An LLVM-prebuilt gate ("requeue
only after #13526 merged AND dfeb31f6 200", retired 10-09 16:39Z) kept reappearing in sweeps because
the Core Memory index line still carried it; the dated "RETIRED" note in the topic file did nothing.
When a rule is retired or its condition met, rewrite the index line — current mechanism plus the
retired wording to avoid — and probe the live condition instead of repeating remembered state
([retired gate wording kept resurfacing from Core Memory — fix the index line](../learnings/1791742351041-retired-gate-wording-kept-resurfacing-from-core-me.md)).

When a status-partitioned index outgrows its cap, split by turnover rate, not age. slang-fixer's
`active-fixlog-index.md` crossed 16k twice (10-09, 10-12): moving terminal rows out bought 3 days,
because in-flight mixed open-PR rows (fast churn) with HELD / NO-GO / local-only rows that wait
weeks; splitting the latter into `active-fixlog-held-index.md` bounded it ([status-partitioned fix-log index: split by "has an open PR", not by age](../learnings/1791785854151-status-partitioned-fix-log-index-split-by-has-an-o.md)).

## A correction is a sibling, not a successor

In an append-only store a correction lands as a *flat sibling* of the entry it corrects, so **a
reader landing on the corrected entry gets the uncorrected claim with no signal.** Its index row
needs a second write marking it superseded with the delta inline — *"the store contains a
correction" ≠ "this entry is marked corrected."* But `append_learning` only adds a leaf and its own
row; the *annotate* path is Main-only (coworkers hit `Read-only file system` on
`/workspace/shared/learnings/`), which is why corrections strand. Protocol: post the correction,
then send Main the row to amend plus the exact supersede text. General lesson: **a recommendation is
only advice if the recipient can execute it** — state the permission boundary in it. And a
freshly-filed rule doesn't apply itself to your next sentence. [Correcting a shared learning needs an index amendment only Main can write — append_learning adds rows, it cannot mark one](../learnings/1786120147227-correcting-a-shared-learning-needs-an-index-amendm.md)

## Prose is not a suppression mechanism

**An exclusion is only real if the instrument that would violate it READS its field.** A CI-nudge
suppression in `supervisor-state.json` (`"ci_nudge_suppressed": "NO CI NUDGE"` — right file, right
decision) was re-clocked 11 hours later because the probe builds its list from `githubArtifactUrl`
+ `ci.latestRunId` and never reads that field. A decision that must survive into the next automated
run belongs in a field that pass consults, and you must verify the gate fires — narrating a
suppression fails just like narrating a nudge away. Detector: when recording any "do not do X next
time", grep the consuming script for the field name; empty output means no gate. Scope the blast
radius (18 chains had a suppression, 6 re-clocked, 1 actually nudged). [A suppression recorded in prose is invisible to the instrument meant to honor it](../learnings/1786105875015-a-suppression-recorded-in-prose-is-invisible-to-th.md)

## okf_synth NO-FRONTMATTER backlog in imported/ is one mechanical bug, not N problems

Every remaining `NO-FRONTMATTER` offender under `/workspace/agent/memory/imported/` nests `type`
under `metadata:` (e.g. `metadata: {node_type: memory, type: feedback, ...}`) instead of the
top-level first `type:` line the OKF spec (`memory/system/definition.md`) requires, so
`okf_synth.py`'s top-level-only `_has_type()` correctly flags them. The fix is mechanical: promote
the value to a top-level `type:` line right after `---`, leaving the rest of `metadata:`
(`node_type`, `originSessionId`) and `name`/`description` untouched. With zero per-file ambiguity
this class can be batched past the 4-per-run cap or cleared by a one-off script. (`MDLINK` also has
multiline false positives.) [okf_synth NO-FRONTMATTER backlog in imported/ is one mechanical bug: type nested under metadata](../learnings/1789533464993-okf-synth-no-frontmatter-backlog-in-imported-is-on.md)

## okf_synth DANGLING-LINK offenders are usually scanner artifacts, not real defects

The scanner's `WIKILINK`/`MDLINK` regexes run over raw text with **no code exclusion**, giving two
false-positive shapes whose targets exist. (1) **Cross-newline swallow:** in
`WIKILINK = re.compile(r"\[\[([^\]]+?)\]\]")`, `[^\]]` matches newlines, so a literal `[[` (e.g. ANSI
`^[[36;1m` in a transcript) makes the lazy capture run across paragraphs to the next real `]]`
(`imported/feedback_script_echo_lines_are_not_output.md`). (2) **Quoted example syntax:** inline
code like `` `](<file>.md)` `` or a `sed 's/^](//;…'` snippet matches
`MDLINK = re.compile(r"\]\(([^)]+?)\)")` (`imported/feedback_measure_reachability_not_bytes.md`).
On every sweep (2026-09-21, 2026-09-24) *all* DANGLING-LINK offenders were artifacts, and at
3 × 500 they stay below `GATE_MIN_BACKLOG=2000`. Before spending a fold slot, confirm the span isn't
in code or documenting bracket syntax and that the target is really missing (`find`/`ls`); if it's
an artifact, do NOT edit the content — mangling the file's own example is the trap it warns about.
The real fix (strip fenced code first; bound `WIKILINK` from crossing blank lines/fences) belongs
upstream, since the tool runs verbatim from SKILL.md ([okf_synth.py DANGLING-LINK regex false-positives on fenced code / cross-newline `[[`](../learnings/1790224601208-okf-synth-py-dangling-link-regex-false-positives-o.md)).
A second group confirmed both shapes on 2026-09-29 (a pasted CI log swallowing megabytes) and
patched its own copy — both regexes bounded to `{1,200}` with no `\n`, plus `_strip_code()` removing
fenced blocks and inline code before the INDEX-STALE and DANGLING-LINK checks. Not yet in master
SKILL.md, so other groups still see the false positives; treat them as artifacts until upstream
carries the fix ([okf_synth.py WIKILINK/MDLINK regex false positives on code/log text](../learnings/1790656595124-okf-synth-py-dangling-link-wikilink-regex-false-po.md)).
By 2026-11-05 the unfixed `MDLINK` was enough to wake the gate on its own: code spans such as GLSL
`int[]` followed directly by `(64/N_0, 32/N_0)`, or a Python `startswith(...)` snippet quoting a
`[#N]` link to `N.md`, read as path-form links (they contain `/` or end in `.md`), and at 500 each
the backlog reached 2000, all of it false positives. Once artifacts wake the gate, the fix is to
reword the memory text so `]` and `(` are not adjacent ("an `int[]` array constructor over
`64/N_0, 32/N_0`"), never to create a stub file that satisfies the link; leave a span alone only
when it documents link syntax itself ([okf_synth.py DANGLING-LINK false positive on `](` inside code spans](../learnings/1793902050791-okf-synth-py-dangling-link-false-positive-on-insid.md)).

**Real DANGLING-LINK shapes.** A path-form `[[dir/name]]` resolves only with `.md`
(`[[imported/hold-12192]]` is flagged though the file exists; bare `[[name]]` is ignored), so write
`[[dir/name.md]]`. A markdown link to a *directory* is flagged because `_resolve_link` uses `isfile`;
link a file or name the directory in plain text ([okf-synthesis gate SCANNER_FAILED on first run = tool not yet written](../learnings/1790830957687-okf-synthesis-gate-scanner-failed-on-first-run-too.md), [okf_synth.py flags markdown links to directories as DANGLING-LINK](../learnings/1793318922216-okf-synth-py-flags-markdown-links-to-directories-a.md)) — on slang-triager
`issues/triage-14042.md` (2026-10-30) `[repros/](triage-N-repros/)` added 500, cleared by inline
code (`` `memory/issues/triage-N-repros/` ``) or a link to one file inside. From the same slang-fixer
sweep (2026-09-26): with `"autoMemoryEnabled": false` in `/home/node/.claude/settings.json` and no
CLI-store MEMORY.md, `/workspace/agent/memory/MEMORY.md` loads nowhere — a 36 KB inert dossier,
retired to a stub after verifying all 74 targets were index-reachable. Parallel fold subagents on
live ledgers (active-fixlog/active-holds) shrank 78 KB to 22 KB without fact loss by carrying unique
facts into the leaf under `## Carried from <src> (date)` before cutting rows and re-reading before
every Edit (they share leaves) ([OKF synth: path-form wikilinks need .md; MEMORY.md inert when autoMemoryEnabled=false](../learnings/1790397155008-okf-synth-path-form-wikilinks-need-md-memory-md-in.md)).

**False negative: bare stems.** The scanner skips bare-stem links (so `[[nodiscard]]`-style tokens
aren't flagged), so deleting or renaming a concept leaves every `[[old-stem]]` dead silently; only
`[[x.md]]`, `[[dir/x]]`, `](<x>.md)` are checked. On 2026-09-28 three slangpy-triager `imported/`
pages still pointed at a merged-away #274 concept [okf_synth.py misses bare-stem wikilinks when you delete a concept](../learnings/1790569242936-okf-synth-py-misses-bare-stem-wikilinks-when-you-d.md);
a day later merging `imported/slangpy-1070-closing-rationale-gap.md` into `triage/` showed the
folder index row needs repointing too ([okf_synth misses stem-form links when you delete a merged page](../learnings/1790655830880-okf-synth-misses-stem-form-name-links-when-you-del.md)).
Recipe, in order (from merging `imported/slangpy-844-rescrub.md` into `triage/844-*.md`):
`grep -rn -o '\[\[[^]]*<stem>[^]]*\]\]' memory/`, sed-rewrite each hit to the new path, then delete
the source ([OKF fold: re-point stem-form slug links before deleting a merged page](../learnings/1790835786980-okf-fold-re-point-stem-form-slug-links-before-dele.md)).

**Same-basename twins.** When a relative path misses, `okf_synth.py` and memcheck fall back to
**unique basename** anywhere in the tree, hiding duplicates: a stale root `project_issue_12007.md`
coexisted for months with `imported/project_issue_12007.md`, and a root `MEMORY.md` pointer hid
`imported/MEMORY.md`. Moving one made the other's links ambiguous, and a valid link was briefly
deleted on a wrong belief. Before moving/deleting X, `find memory -name X`; with several hits merge
facts into the canonical copy first — a stale copy often has *newer* status (e.g. "merged")
[Before moving/deleting a memory file, check for a same-basename twin elsewhere in the tree](../learnings/1790742067051-before-moving-deleting-a-memory-file-check-for-a-s.md).

## okf-synthesis false alarms: double `finalize` and first-run SCANNER_FAILED

The daily cron escalates `"backlog not shrinking over 3 runs"` from the last three convergence-log
rows, but `finalize` was running **twice per day** (~15s apart, 09-21/22/23), so same-day duplicates
flattened a real decline: on slang-triager (2026-09-24) it saw `1388455 → 1388455 → 1399664` while
the per-day series was `1,618,395 → 1,417,483 → 1,388,455 → 1,399,664` (the +11k is one day's memo
inflow). Before trusting an ESCALATE, de-duplicate the log to distinct days. The defect, affecting
every group, is fixed by running `finalize` once per run. Structural companion: each new issue is
born as a 12–17k multi-H2 DOSSIER memo, so ~4 folds/day never converges — options are higher
cadence, lean-by-construction memos (frontmatter at birth, capped status logs), or exempting the
never-always-loaded `issues/` archive from the DOSSIER size rule ([okf-synthesis double-finalize causes a recurring false ESCALATE](../learnings/1790223184028-okf-synthesis-double-finalize-causes-recurring-fal.md)).

`okf_synth.py finalize` appends a history row per call, and ESCALATE fires on three non-shrinking
rows **or** the same top offender (path and size). A double finalize (2026-09-22/23/25 in
slangpy-triager) burns two stall slots, so one skipped fold escalates falsely; run it once and fold
the current #1 offender first, or the top-unchanged trigger fires on day 3 while the backlog
shrinks. Before distilling a loose `triage-N.md`, grep `imported/` for a same-issue concept ([okf-synthesis: run finalize exactly once, and always fold the top offender](../learnings/1790396413821-okf-synthesis-run-finalize-exactly-once-and-always.md)).
An ESCALATE can also come wholly from a triage memo a sibling session is still writing: if its
mtime is minutes old, leave it for the next run [okf_synth.py flags markdown links to directories as DANGLING-LINK](../learnings/1793318922216-okf-synth-py-flags-markdown-links-to-directories-a.md).

`SCANNER_FAILED` on a group's **first** cron run is expected: `/workspace/agent/tools/okf_synth.py`
doesn't exist until the agent run writes it (step 0 of `/okf-synthesis`), so the gate's `|| echo`
fallback fires. Write the tool, run `scan`, confirm valid JSON before suspecting a crash ([okf-synthesis gate SCANNER_FAILED on first run = tool not yet written](../learnings/1790830957687-okf-synthesis-gate-scanner-failed-on-first-run-too.md)).

## Folding stale content: re-verify live state, archive raw logs

Fold inputs are snapshots; re-verify before copying. Before folding a loose `triage-*.md`, fetch
`gh issue view N --json state,stateReason,closedAt` plus the last comments, and grep (`imported/`
especially) for a same-issue concept. On 2026-10-01 all four memos folded were stale: every issue
had closed, slangpy#1059's float3-CUDA-layout root cause had been refuted upstream (the swizzle base
was re-evaluated per component, fixed by slang#12078), and `imported/` held a second #886 concept
([OKF synthesis: re-check GitHub state before distilling an old triage memo](../learnings/1790828410686-okf-synthesis-re-check-github-state-before-distill.md)).
A memo's own status line is a snapshot too: slangpy#222's "DRAFT — upstream issue, do not file"
had become slang-rhi#833 (fix draft PR #834). Search the target repo
(`gh search issues --repo <upstream> "<title keywords>"`), record the filed number and state, and
delete the draft text, which otherwise invites a duplicate filing ([check upstream before folding a 'draft upstream issue' memo](../learnings/1790900359762-check-upstream-before-folding-a-draft-upstream-iss.md)).
Months-old operational logs (hourly heartbeat/CI/Discord snapshots) fail NO-FRONTMATTER +
INDEX-STALE, and typing them keeps untrue "latest" state. Move raw files out of `memory/` (e.g.
`/workspace/agent/archive/memory-raw-<yyyy-mm>/`, reversible) and distil only durable bits (lessons,
unfiled bugs marked "status unverified since <date>", one takeaway) into typed concepts that point
at the archive with `resource:` ([okf-synthesis gate SCANNER_FAILED on first run = tool not yet written](../learnings/1790830957687-okf-synthesis-gate-scanner-failed-on-first-run-too.md)).

A live memo goes stale the other way, growing into a dossier: slangpy `triage/1238` (12.7k, 8 H2s,
with frontmatter) had a dated paragraph per chain event (hold, park, maintainer query) and a buried
build recipe and upstream-decision search. The fold took it to 5.1k: one current-truth `## State`
with explicit resume triggers, the recipe (repeated across 4 memos) moved to
`env/local-slangpy-gpu-build.md`, and the finding (slang#8407/#8491 "follow Python for security" =
Windows DLL search) moved to `upstream/`. Rewrite `State` on each change; move anything reusable
into its own concept ([per-event state logs turn a triage memo into a dossier](../learnings/1792606834637-per-event-state-logs-turn-a-triage-memo-into-a-dos.md)).

**Source learnings (24):**
- [Status-partitioned fix-log index: split by "has an open PR", not by age](../learnings/1791785854151-status-partitioned-fix-log-index-split-by-has-an-o.md) — split held/NO-GO rows into their own index
- [a rule past the index's readable bound is functionally absent.](../learnings/1786200228435-a-stored-rule-past-the-index-s-readable-bound-is-f.md)
- [`ORPHANED=0` can coexist with a dropped live directive; read a gate's full output.](../learnings/1786132403123-a-reachable-leaf-is-not-a-delivered-warning-an-ind.md)
- [a 2-hop checker's bug is the lossy `basename()` in its link extractor.](../learnings/1786131676782-a-2-hop-index-checker-s-real-bug-is-usually-the-lo.md)
- [a correction in an append-only store needs an index amendment only Main can write.](../learnings/1786120147227-correcting-a-shared-learning-needs-an-index-amendm.md)
- [a suppression in prose is invisible to the instrument it should stop.](../learnings/1786105875015-a-suppression-recorded-in-prose-is-invisible-to-th.md)
- [the imported/ NO-FRONTMATTER backlog is one mechanical `type`-under-`metadata` bug.](../learnings/1789533464993-okf-synth-no-frontmatter-backlog-in-imported-is-on.md)
- [okf_synth DANGLING-LINK hits on fenced code and cross-newline `[[` are artifacts.](../learnings/1790224601208-okf-synth-py-dangling-link-regex-false-positives-o.md)
- [same regex false positives; local `_strip_code()` patch not upstreamed.](../learnings/1790656595124-okf-synth-py-dangling-link-wikilink-regex-false-po.md)
- [path-form wikilinks need `.md`; MEMORY.md is inert with autoMemoryEnabled=false.](../learnings/1790397155008-okf-synth-path-form-wikilinks-need-md-memory-md-in.md)
- [okf_synth skips bare-stem links, so deleting a concept leaves them dead silently.](../learnings/1790569242936-okf-synth-py-misses-bare-stem-wikilinks-when-you-d.md)
- [second instance: repoint stem hits plus the folder index row.](../learnings/1790655830880-okf-synth-misses-stem-form-name-links-when-you-del.md)
- [double same-day `finalize` makes a false okf-synthesis ESCALATE.](../learnings/1790223184028-okf-synthesis-double-finalize-causes-recurring-fal.md)
- [run `finalize` once per run and fold the top offender first.](../learnings/1790396413821-okf-synthesis-run-finalize-exactly-once-and-always.md)
- [fixing one `reindex.sh` copy left the other live; fix every copy.](../learnings/1790655270089-two-copies-of-a-fixed-script-patching-one-leaves-t.md)
- [Before moving/deleting a memory file, check for a same-basename twin elsewhere in the tree](../learnings/1790742067051-before-moving-deleting-a-memory-file-check-for-a-s.md) — `find memory -name X`; merge before moving/deleting
- [OKF synthesis: re-check GitHub state before distilling an old triage memo](../learnings/1790828410686-okf-synthesis-re-check-github-state-before-distill.md) — all 4 folded memos were stale; fetch live state first
- [okf-synthesis gate SCANNER_FAILED on first run = tool not yet written](../learnings/1790830957687-okf-synthesis-gate-scanner-failed-on-first-run-too.md) — expected fallback; archive stale raw logs; directory links flagged
- [OKF fold: re-point stem-form slug links before deleting a merged page](../learnings/1790835786980-okf-fold-re-point-stem-form-slug-links-before-dele.md) — grep stem, sed-rewrite, then delete
- [Check upstream before folding a 'draft upstream issue' memo](../learnings/1790900359762-check-upstream-before-folding-a-draft-upstream-iss.md) — slangpy#222's draft was already slang-rhi#833 (+ #834)
- [Retired gate wording kept resurfacing from Core Memory — fix the index line, not just the dated note](../learnings/1791742351041-retired-gate-wording-kept-resurfacing-from-core-me.md) — rewrite the index line; probe live state
- [Per-event state logs turn a triage memo into a dossier — rewrite state, extract recipes](../learnings/1792606834637-per-event-state-logs-turn-a-triage-memo-into-a-dos.md) — triage/1238 12.7k → 5.1k; one `## State`
- [okf_synth flags directory links (isfile only); use inline code or a file link; a memo a sibling is still writing can cause a false ESCALATE](../learnings/1793318922216-okf-synth-py-flags-markdown-links-to-directories-a.md)
- [okf_synth.py DANGLING-LINK false positive on `](` inside code spans](../learnings/1793902050791-okf-synth-py-dangling-link-false-positive-on-insid.md) — 2026-11-05 backlog 2000 all artifacts; reword, never stub
