---
name: project_6519_precompiled_reflection_scrub_closed
description: "slang#6519 precompiled-reflection-test scrub CLOSED 2026-08-05 — verdict still-relevant/needs-owner; triager's comment patched for narrow aperture + caveat disclosed only up-chain; unfiled SIGSEGV held."
metadata: 
  node_type: memory
  type: project
  originSessionId: 54801730-9e35-4171-a141-587ad25e12a0
---

# slang#6519 "Precompiled Target Test: Reflection" — scrub CLOSED 2026-08-05

**No RESUME needed.** Chain terminal: triager posted the scrub, disposition is a maintainer call
(cheneym2), nothing pending on our side.

## Outcome
- Routed the `jkiviluoto-nv` scrub request to `slang-triager`; first turn died on a **429**, redriven
  in full on the same canonical thread (`gh-issue-shader-slang/slang-6519`). Second turn delivered.
- Comment posted: `issuecomment-5196755939`, `nv-slang-bot[bot]`, 8002 chars, 20:05:48Z, comments 1→2.
- Verdict: **still relevant, needs a new owner.** Neither half of the ask (precompiled variant /
  layout-invariance assertion) is covered at master `b0e43d657`.
- Recommend-don't-execute honoured — verified post-hoc: issue `open`, `labels: []`, assignee still
  `mkeshavaNV`, milestone untouched.

## What I independently reproduced (did not take on trust)
- **Coverage absence — and it's WIDER than published.** The triager scoped it to `tests/reflection/`
  (0 hits, control `-target`=43). GitHub code search repo-wide: **no `tests/` file combines a
  `REFLECTION` directive with precompiled-module usage** (`embed-downstream-ir`+`REFLECTION` → `[]`;
  `REFLECTION`+`slang-module` → `[]`; control `embed-downstream-ir path:tests` → 10 files). Different
  instrument (`git grep` vs code search), same conclusion, broader scope.
- Milestone 10 `Q2 2026 (Spring)`: `state: closed`, `due_on 2026-06-30` ✓.
- Cited host test + oracle both exist at master: `multi-file.hlsl` 1061 B, `.expected` 25802 B ✓.

## Unfiled adjacent finding — left with the issue, deliberately
Triager hit a **SIGSEGV** at SPIR-V emit passing an entry point's own resource into a function in a
*precompiled* module (`IRLinkageDecoration::getMangledName()` via `emitFuncDeclaration`,
`slang-emit-spirv.cpp:4185`, `si_addr=0x4`). Needs `-embed-downstream-ir` **and** `-target spirv`
**and** a resource crossing the boundary; 4 controls pass. Distinct from #6572/#6542 (those fail at
the *precompile* step with `E99999`; this exits 0 there and crashes at *consume*) and not #12355.
**Not filed** — offered on the issue. If a human wants it tracked, it's a fresh issue, not a dup.

⚠️ Triager could not run the `REFLECTION` directive itself (`slang-reflection-test` **not built in
its container**) — it substituted `slangc -reflection-json`, arguing both funnel into
`emitReflectionJSON`. Reasonable, but the harness leg is *unexecuted*; a new owner should not read
"measured" as "ran the directive".

## Both defects PATCHED and re-verified (20:15:24Z)
Raised 2 defects with the triager; it opened the live artifact and fixed both **in place** —
len 8002→9314, `updated_at` 20:15:24Z vs `created_at` 20:05:48Z, **comments still 2** (edited, not
stacked). Re-verified by me: `not built`=1, `unexecuted`=1 (both were **0** pre-patch);
tree-wide aperture now in the comment (`75`, `35`, `tests/bugs`, `tests/bindings` all present);
**SIGSEGV survived into the public artifact** (`SIGSEGV`=3, `getMangledName`=1,
`slang-emit-spirv.cpp`=1) so that finding is not stranded in a local memo. Control string → 0.

**Edit-in-place was safe here, and the check is cheap:** only 2 comments exist — the 18:40 request
and our 20:05 post — so **nobody wrote into the 10-min pre-patch window**. And because the edit
strengthened the *same* comment, the notification the maintainer already got from *creation* now
leads to correct content. Contrast [[feedback_an_in_place_edit_notifies_nobody]]: an edit is only
adequate when no one has acted on the stale text AND you aren't relying on the edit itself to
deliver news. Both held.

## ⭐ `grep -c` counts LINES, `grep -o | wc -l` counts OCCURRENCES
Near-miss on a *shared* count: I published `getMangledName`=1, triager measured **2**. Neither wrong —
both hits sit on **one line** of the comment body, and they are **two distinct symbols**
(`getMangledName` + `getMangledNameOperand`). Verified at source: `grep -c`→1, `grep -o|wc -l`→2,
`grep -o 'getMangledName[A-Za-z]*' | sort | uniq -c` → 1 each.
⇒ **Match a number to its SYMBOL AND UNIT, never to its value.** An unqualified count exchanged
between two parties will later read as a contradiction and trigger a re-audit of an artifact that was
never defective. When publishing a count as evidence, say *lines* or *occurrences* — and note
`grep -c` **undercounts** multiple hits on one line, so it is the wrong instrument for "how many
times does X appear".

⭐ **The generalizable defect (triager's framing, worth keeping):** neither defect was a wrong fact.
Every number was true, the conclusion was true, and I agreed with the verdict. What was wrong was
(a) the **aperture** — two decisive zero-probes scoped `tests/reflection/` (35 of 75 reflection-test
files) supporting a tree-wide *sentence*; and (b) **where the caveat lived** — the harness limitation
was disclosed to *me* and never to GitHub, i.e. to the audience that actually acts on it.
⇒ **Audit aperture and disclosure SEPARATELY from the answer; a correct conclusion draws no pushback
on a narrow aperture or a missing disclosure.** Per limitation ask: *which audience acts on this, and
does the artifact THEY read contain it?*

## Cross-links
- Fan-out sibling: [[project_6524_link_time_constant_precompiled_scrub]] — same request 2 s earlier,
  independently scrubbed by another session. See the shared learning on verifying a fan-out **set**
  (enumerate from `commenter:` search; then check sessions before calling silence an orphan).
- Instrument traps used here: [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]]
  (429 handling), [[feedback_last_active_tracks_inbound_not_agent_work]] (watched the issue's comment
  count, not the session), [[feedback_no_evidence_names_where_you_looked]] (every zero got a control).
