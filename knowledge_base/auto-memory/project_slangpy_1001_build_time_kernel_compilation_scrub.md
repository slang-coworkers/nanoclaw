---
name: project_slangpy_1001_build_time_kernel_compilation_scrub
description: "slangpy#1001 'Move kernel compilation to build time' — jkiviluoto-nv asked (2026-08-05) to scrub it after author mkeshavaNV left. Scrub: STILL RELEVANT, needs a FIRST-TIME owner (never assigned), do not close. ⛔ Issue body is TRUNCATED — Solution section empty."
metadata: 
  node_type: memory
  type: project
  originSessionId: 59a5d801-d899-4929-873e-3b62abc8646f
---

# slangpy#1001 — "Move kernel compilation to build time"

**Chain opened 2026-08-05** by webhook: `jkiviluoto-nv` mentioned `@nv-slang-bot` on
https://github.com/shader-slang/slangpy/issues/1001#issuecomment-5195826585 —
*"Mukund (mkeshavaNV) won't be returning to this work for a while. Please scrub this issue and
assess whether it is still relevant, needs reassignment, or should be closed."*

Canonical thread: `gh-issue-shader-slang/slangpy-1001`.
Mention is a real `@nv-slang-bot` mention ⇒ GitHub posting authorized for the tier holding the verdict.

**RESUME TRIGGER:** (a) any `issue_comment` on shader-slang/slangpy#1001, **or**
(b) `slangpy-triager` reports its scrub verdict on thread `gh-issue-shader-slang/slangpy-1001`.

## ⛔ MY OWN FALSE STATUS VERB — caught before it became a receipt

This file originally read **"Routed to `slangpy-triager`"** in both the description and this
section. **No dispatch had fired** — I wrote the memo, then a container restart landed between the
write and the `send_message`. Verified absent with controls (2002 session rows, 186 `slangpy-`
threads ⇒ the instrument fires): the triager group `ag-1780667169498-sqxdef` holds 32 slangpy
threads including siblings **820/821/822/823/844/899 — and NOT 1001.**

⭐⭐⭐**Write the status verb only AFTER the call returns; on resume, distrust your own last few
lines. A memo is not a receipt.** This is the third instance of this exact failure in ~24h across
this store (the triager disclosed it to me on #823; a sibling session reproduced it on #821; here
it is on #1001) ⇒ **not an anecdote, a systematic hazard of writing memory before acting.**
See [[project_slangpy_821_empty_body_scrub_cluster]].

✅**DISPATCH NOW REAL, verified after the call returned** (2026-08-06): `send_message` id **17** to
`slangpy-triager` on `gh-issue-shader-slang/slangpy-1001`, with `<github-post-authorized />`.
Post-send enumeration confirms the thread is present for `ag-1780667169498-sqxdef` (control: 2002
rows). Siblings deliberately NOT dispatched — their own webhooks already routed 820/821/822/823/844/899;
parallel fan-out to one peer duplicates sessions.

## Issue state as measured (not inferred)

- filed **2026-05-26** by `mkeshavaNV`; **open**; **zero assignees, zero labels, no milestone**.
- exactly **1 comment** — the scrub request itself. Timeline is only 3 events (comment, mention,
  subscribe). **Nobody ever discussed this issue on GitHub.** No cross-references, no linked PRs
  (`search/issues?q=…1001 in:body` → 0 hits).

## ⛔ The load-bearing finding: the body is truncated

The issue is a long, high-quality writeup (4127 bytes) that **ends mid-thought**:

```
## Solution

A first-class build-time compilation flow analogous to
`slangtorch_library`. Any of the following shapes would be sufficient:
```

…and then **nothing**. The enumerated solution shapes are absent.

⭐ **Verified two independent ways before believing it** — REST `.body` piped through `cat -A`
(confirms the file truly ends there, no trailing content, final byte is a newline) *and* GraphQL
`bodyText` (same terminus). This is not a fetch/pagination artifact of one API; the stored body is
incomplete. ⇒ **When a claim is "the upstream data itself is malformed", one API's rendering is not
evidence — a second API surface over the same field is the cheap discriminator.**

Why it matters: the issue documents the *problem* superbly (pipeline diagrams, measured costs) but
the author's *proposed designs* are the missing part, **and the author has left**. Anyone picking
this up inherits a well-specified problem with an unspecified solution space.

## Is it still relevant? — YES

The tempting close is "a persistent shader cache landed, so this is fixed." **That is wrong**, and
the ordering is what proves it:

| PR | what | merged |
|---|---|---|
| #555 LMDB cache | cache primitive | 2025-10-08 |
| #561 persistent cache on LMDB (`IPersistentCache`) | the shader cache | 2025-10-10 |
| #1036 Add CacheWriter | moves cache **writes** off the foreground compile path | 2026-06-30 |

⭐⭐ **#561 predates the issue by 7 months, and the issue explicitly acknowledges it** — it names
`Device.shader_cache_path` and explains why the cache is *insufficient*: it only helps when "the
path strings slang stores in IR are stable across processes — typically not the case under
sandboxed tests, build systems with per-invocation paths, or any setup that doesn't pin slang
sources at a fixed absolute path." So the cache is the thing being critiqued, not the remedy.

#1036 (the only post-filing cache work) is a **write-path latency** improvement by `skallweitNV`
("background worker to move persistent shader/cache writes off the foreground compilation path").
It does not create a shippable build artifact and does not touch path stability. ⇒ **A merged PR
whose title matches the issue's topic is not a fix; read what it changed. Here the matching PR
improves the very mechanism the issue argues is inadequate.**

The ask — a build-time flow analogous to `slangtorch_library`, compile once and ship the artifact —
has **no** implementation. Measured cost in the issue: ~3s simple / ~5s medium / 25–75s heavy
generic per call site, **~7 min aggregate first-process startup** on a ~30-call-site A40 workload.
Related closed work is narrower: #509 "Support precompiled modules" (load `.slang-module`,
completed 2025-11-17) and #637 "Add precompiled module test" (merged 2025-11-14) — module *loading*,
not a build-time compile-and-ship pipeline.

## ⛔ "Reassignment" is the wrong verb — #1001 was NEVER assigned

My first draft said "needs reassignment," inheriting the requester's framing. Measured instead:
**zero `assigned`/`unassigned` events in the entire timeline, zero current assignees.** mkeshavaNV
*filed* it and never *owned* it in the tracker.

⇒ ⭐⭐**"Reassign" presupposes a prior assignment. The actual ask is FIRST-TIME ownership of an
unowned issue** — a harder sell to a maintainer, and a different action (find an owner for orphaned
design work vs. transfer a live workload). The requester's stated reason — *"Mukund won't be
returning to this work"* — is a **template applied by an author-or-assignee sweep**, so for #1001 it
is true of authorship but says nothing about assignment.

⭐⭐⭐**A batch mention's stated reason is a hypothesis about each artifact, not a finding about any
of them.** The sibling scrub found the premise outright FALSE for #820/#821 (already moved to
`ccummingsNV` 5 months earlier). Same batch, three different underlying situations. **Verify the
premise per-issue; never inherit it.** See [[project_slangpy_821_empty_body_scrub_cluster]],
[[feedback_a_reporters_framing_is_a_hypothesis_not_a_finding]].

⚠️`search/issues?q=…commenter:jkiviluoto-nv "won't be returning"` returned **total_count 0** while
I can read that very comment on #1001 — GitHub's search index does not reliably cover comment
bodies. The batch's real extent (slangpy #1001/#899/#822/#821/#820/#768/#844, slang #9661) is
established by the sibling chains' per-issue reads, **not** by that search. ⭐**A zero from a search
index is not an absence in the data.**

## ✅ CHAIN CLOSED 2026-08-06 — triager posted; four of my claims were corrected

`slangpy-triager` posted delta comment **`5199057817`** (00:39:06Z, 6,770 chars, **fresh comment, not
a PATCH**), verified by me: `edited: false`, issue still `OPEN` / `assignees: []` / `labels: []` /
`milestone: null` — it mutated nothing.

⛔**A prior scrub had ALREADY been posted before my dispatch and I never saw it:** bot comment
`5196939912`, **20:24:53Z**, 5,753 chars, full 5-bullet verdict. My read was ~18:5xZ showing
`comments: 1`; I briefed the peer ~4h later from that snapshot. ⇒ ⭐⭐⭐**A GitHub read is a snapshot
with a timestamp, not a standing fact — re-read immediately before briefing, especially on a chain
with an active fan-out where sibling tiers are writing.** My dispatch sent a peer to produce a
verdict that was already public.

Corrections the triager made to **my** work (all verified by me):
1. **"Truncated" → "never written"** — body is 4,054 chars vs a 65,536 limit. My error; own leaf:
   [[feedback_body_ending_early_is_not_evidence_of_truncation]].
2. **"Window is closing" → unverifiable** — his last *authored* comment: #899 2026-03-30, #510
   2025-09-16, **#1001 never**; ~4 months silent. ⚠️`search/issues --sort updated` showed his items
   updated hours ago — that was **the sweep's own bot comments + subscribe events**, not him.
   ⭐**An issue's `updated_at` is not evidence its author is active.**
3. **"8 open items" → 39 / 27 / 5** — my single repo-scoped query could not see 22 slang items by
   construction; own leaf: [[feedback_a_count_is_only_as_wide_as_its_querys_scope]].
4. **#1013 `defer_target_compilation`** (tdavidovicNV, 2026-06-03) — I missed it entirely; defers
   codegen rather than persisting it.

Its own PATCH plan was also wrong and it fixed that itself, with **better** grounding than my
notification argument: sibling comment `5197009490` on #510 @20:32:15Z proves a **parallel session**
wrote the standing comment ⇒ *"edit if last poster is self"* silently assumes *self* = *this
session*, false under a shared bot identity with concurrent fan-out. My route (edits notify nobody,
[[feedback_an_in_place_edit_notifies_nobody]]) and its route (never patch a sibling's work) converge.

### ⭐⭐⭐ The headline finding is the triager's, and I replicated it independently

**`slangtorch_library` — the reference design the entire issue is premised on — does not exist.**
My own rederivation, controls first (a negative capability claim is the error class with no failure
signature — [[feedback_published_negative_env_claims_need_rederivation]]):

| query | result |
|---|---|
| `slangtorch_library` code, org-scoped | **0** |
| `slangtorch_library` code, **GitHub-wide, no org scope** | **0** |
| `slangtorch_library` issues, org | **1** — #1001's own body |
| control `slangtorch` org code | 50 ✅ |
| control `slang_library` (the real, unrelated CMake fn) | 6 ✅ |
| control `loadModule` org code | 654 ✅ |

I added the **unscoped** GitHub-wide search — the org-scoped zero can't distinguish "nowhere" from
"not in this org," and the sweep's own lesson is that scope creates silent zeros. Still 0. Triager
separately: 0 across 1,644 commits on all refs, with live in-repo controls (56 / 10).

⇒ **The ~7min-vs-near-zero baseline cannot be verified from public code as written.** Its public
comment correctly splits **FACT** (no public `slangtorch_library`) from **HYPOTHESIS** (shorthand for
the ninja/`cpp_extension` flow, or an internal NVIDIA wrapper). ⭐⭐**This reframes the author-dependent
question from "finish your Solution section" to "what was the baseline?" — sharper, and answerable by
others**, which matters against a 4-month-silent account.

⚠️**Not verified by anyone: the magnitudes.** 3s/5s/25–75s and ~7min are the reporter's A40
measurements; both tiers confirmed **mechanism, not magnitudes**, and said so publicly. Related:
`slangpy/benchmarks/ppisp/` measures steady state with warmup ⇒ **cold-start cost has no CI
regression guard.**

⭐**Its own control caught it mid-task and it disclosed it:** a first `git log --all -S` run executed
in `/tmp`, where **target AND control both returned 0** and `fatal: not a git repository` was easy to
skim. Re-run in the checkout: controls 56/10, target 0. Textbook
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] — caught by the control, not by luck.

Also: the standing comment miscites `device.cpp:363-364` for cache paths (those lines are
shader-model/feature-query code; real sites `device.h:157`/`:162`, `device.cpp:98-118`) — triager used
the correct pointers and did not repeat it. Verbatim memo:
[[project_slangpy_1001_triager_memo_verbatim]].

**Open state:** issue remains OPEN, unowned, awaiting a **human roadmap decision**. Nothing further
from me; sibling sessions hold the rest of the cluster.

## Reassignment context — this is bigger than #1001

`mkeshavaNV` has **8 open items** in slangpy, so the departure orphans a cluster, not one issue:
#1001, #899 (bool dtype for native Tensor), #822/#821/#820 (raw entry-point wrapping trio),
#768 (raw dispatch), #510 (DiffTensorView support), plus stale draft PR **#904** `[DNS] Dev/mkeshava/benchmark test`
(`dev/mkeshava/benchmark_test`, 6 commits, 4 files, untouched since **2026-05-18**).

I scoped my scrub to #1001 as asked, but flagged the cluster upstream — reassigning one of eight
leaves seven dark.

## Verdict handed to the triager

**Still relevant · needs a FIRST-TIME owner (never assigned) · do NOT close**, with a third action
the requester didn't list: **recover the missing Solution section** (ask `mkeshavaNV` while
reachable, or have the new owner re-derive the design options from the intact problem statement).

⚠️**Scope honesty:** "still relevant" rests on *no build-time flow exists* — established from the
merged-PR record (#561 predates and is critiqued by the issue; #1036 is write-path latency only) and
from #509/#637 being module *loading*. I did **not** build slangpy HEAD or grep the source tree for a
`slangtorch_library` analogue. That is a **documentary** verdict, not a HEAD-verified one; the
triager should confirm against HEAD before publishing "no implementation exists."

Related: [[project_6519_precompiled_reflection_scrub_closed]],
[[project_6542_nested_parameterblock_precompile_ice]]
