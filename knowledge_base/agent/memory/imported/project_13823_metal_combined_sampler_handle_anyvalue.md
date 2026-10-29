---
type: project
name: project_13823_metal_combined_sampler_handle_anyvalue
description: "PARKED ON MAINTAINER 10-22 01:06Z. slang#13823 (albertrodriguezclo, external): Metal AnyValue packs a combined Sampler2D.Handle into 8 bytes and casts it to and from ulong. Bot draft #13843 (fix/issue-13823@81efc9ddf6, diagnostic-only E41014, fixer sess-1792610420980-0vwcru) passed peer review R2 (APPROVE, 0/0/0) and is HELD as a draft at the reporter\'s request; the reporter\'s 16-byte commit (now 07f2d85dd, M4 runtime-tested 10-22 09:57Z) becomes a PR after #13755 merges. Maintainers pick (shepherd saipraveenb25). Spin-off #13851 (CPU) is owned here. One-shot rechase-13823-maintainer-2329 on 10-28 12:00Z."
metadata:
  node_type: memory
  type: project
---

# slang#13823: Metal combined `Sampler2D.Handle` in an AnyValue

Dated history (every dispatch, verdict and live check): [[project_13823_metal_combined_sampler_handle_anyvalue_history]].
Parent chain: [[project_13753_metal_anyvalue_texture_handle_cast]] (PR #13755). Spin-off: [[project_13851_cpu_combined_sampler_anyvalue_bitcast]].

## Current state (as of 10-22 09:57Z)

**Parked on the maintainer pick between two fixes; code side done.** Shepherd saipraveenb25 was asked in delta
cmt 6328073437 (still the newest bot comment, still accurate).

| Option | Where | State |
|---|---|---|
| **A — diagnostic** (located E41014 at all 5 Metal AnyValue producers) | bot draft [#13843](https://github.com/shader-slang/slang/pull/13843) `fix/issue-13823`@81efc9ddf6, fixer `sess-1792610420980-0vwcru` (PR-mapped) | R2 APPROVE 0/0/0; 14/14 (master 4/14); suites 3053/3053; compile-only for Metal. HELD as draft: no ready-flip, no pushes unless a maintainer asks. Clarity renames held on local `wip/13823-r1-clarity` (22e91d0d66). |
| **B — 16 bytes** (keeps #11540's no-host-producer decision; E41019 when a type no longer fits) | reporter branch `albertrodriguezclo:fix/metal-combined-sampler-on-13755`, now 07f2d85dd (557906ff6 + #13755's ebc7691ab) | Stacked on #13755 (open; head 075169d4d on 10-25). Reporter opens a PR once #13755 merges, unless maintainers prefer A. Runtime-tested on Apple M4 (cmt 6337983099): 6 new lanes pass, `tests/metal` 326/327. |

Deferred to maintainers: the E41014 wording (raised by reviewers A, C and Devin). After a pick of A: CI after the
ready-flip, incl. `check-formatting` and macOS Metal lanes (skipped while draft).

**Resume:** webhooks (#13843 → fixer via mapping; #13823 comments → Main) and the `/supervise-issues` tick, which carries
#13823 in `supervisor-state.json`. The one-shot `rechase-13823-maintainer-2329` fired 10-28 12:00Z and found no change;
per its order it was **not** rescheduled, so no per-issue timer remains.

**10-28 re-check:** #13843 open draft @81efc9ddf6, no reviews. #13755 open, not merged: jkwak-work CHANGES_REQUESTED again
10-22 18:53Z (inline `_slang_reinterpretBits`); the reporter answered in 075169d4d on 10-25 06:33Z, re-review pending.
No reporter PR yet, no maintainer pick, no bot mention. **10-23 13:57Z jkwak-work assigned #13823 to themself and
unassigned saipraveenb25,** so the pick now sits with jkwak-work (also #13755's reviewer). Not a pick by itself.

## Cause (triage, reproduced on master 23f8fbe9b and 2026.13.1)

AnyValue sizing and marshalling (emit.cpp:1759, :1821) run before `lowerCombinedTextureSamplers` (:1948), and the IR size
of a combined handle is 8 (ir-layout.cpp:547). `canTypeBeStored` skips the opaque check on Metal and runs only when a
multi-element type set is sized, so #13843 raises E41014 in `generateAnyValueMarshallingFunctions` instead — that also
covers the single-conformer `createDynamicObject`, `reinterpret` and `throws` paths. #13843 touches no slang-emit-metal.*
file, where jkwak-work asked #13755 to stay. #11540 (closed 06-26 by jhelferty-nv) is the won't-implement-host-producer
precedent option B respects.

## Decisions and lessons

- **Reporter ownership can flip within minutes.** 22:01Z "go ahead with the diagnostic", 22:25Z opened #13844 and asked us
  to hold, 22:29Z closed #13844 as a stacked commit. Neither option supersedes the other until a maintainer picks; we hold
  our draft, do not close it, and give no verdict on theirs.
- **Applying review remedies to a held draft is allowed** — the hold forbids advancing toward merge, not fixing known test
  holes before a maintainer compares the options.
- **Fresh delta vs. in-place edit:** once a human comment is newest on the issue, the next state change is a fresh delta
  comment, not a PATCH of ours (the triager corrected my plan here, 22:03Z).
- **Relay through the fixer's parent edge** (the triager), never to the fixer directly.
- **A cross-reference is not a webhook:** the reporter's future PR may arrive silently — the rechase's timeline read covers it.
- **Cross-repo `/compare` on a fork returns 401 through the gateway;** compare from upstream instead:
  `shader-slang/slang/compare/<sha>...owner:repo:branch`.
- **A non-summons reporter update** (the M4 test report) gets no dispatch and no bot post; update the rechase and send one
  dashboard line when it changes the evidence the pick rests on.
- **CPU sampler-half drop** was filed as #13851 on my order (the #13620/#13622 precedent: owned by this chain, no fixer);
  its `issue_opened` webhook is not a fresh triage. The reviewer's "Metal segfault" side note is existing #13654.
