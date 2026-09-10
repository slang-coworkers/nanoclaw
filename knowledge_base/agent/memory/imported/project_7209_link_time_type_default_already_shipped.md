---
name: project_7209_link_time_type_default_already_shipped
description: "slang#7209 'Default structure for link-time types' ANSWERED 2026-08-05 (comment 5196877252) — feature ALREADY WORKS; issue was filed 2025-05-22 INSIDE the window when #6555 had regressed it. Recommended close-as-already-implemented; maintainer's call."
metadata: 
  node_type: memory
  type: project
  originSessionId: 77447150-64ee-4e84-9210-058fedaae091
---

# slang#7209 — a feature request filed during its own regression window

**ANSWERED 2026-08-05**, comment `5196877252`. Maintainer `jkiviluoto-nv` asked for a scrub
(original author `mkeshavaNV` off the work). Verdict: **already implemented**, recommended
close-as-already-implemented, **left open** for a maintainer to pull the trigger.

## The finding

Requested syntax `extern struct Sampler : ISampler = FooSampler` **works today**. Proven by
execution, not by reading: prebuilt `slangc` at `/workspace/agent/slang/build/Release/bin/slangc`,
`-target hlsl`, one-token differential on the default:

| default | emitted dispatch | emitted `offset` |
|---|---|---|
| `= FooImpl` | `FooImpl_setValue_0` / `FooImpl_getValue_0` | `+ -1.0f` |
| `= BarImpl` | `BarImpl_setValue_0` / `BarImpl_getValue_0` | `+ 2.0f` |

`IFoo::offset` is `-1` in `FooImpl`, `2` in `BarImpl` ⇒ swapping ONE token flips both the dispatched
functions and the interface constant ⇒ the default is **semantically applied**, not merely parsed.
⭐⭐ **"It compiles" would NOT have supported the verdict; the differential is what did.**

Implementation: `slang-parser.cpp` accepts `= <TypeExp>` after the inheritance clause;
`slang-check-decl.cpp` checks `aliasedType` independently of `ExternModifier`. Docs already assert
it generally (`docs/user-guide/10-link-time-specialization.md:174`, "constant **or type**").

## ⭐⭐⭐ The archaeology that changed the verdict

**#6555 "link time default error"** (2025-03-10 → closed 2025-06-25) reported THIS EXACT construct
failing with `error 45001: unresolved external symbol '_SW3Foo4ifoo4IFoo'` — the `slang-rhi`
`link-time-default` unit test was red. **#7209 was filed 2025-05-22 — INSIDE that window.**

⇒ **The request was very likely "this doesn't work" misfiled as "please add this".** A feature can
look ABSENT because it is REGRESSED. ⭐⭐ **On any aged feature request, check whether a regression
was open at filing time** — `gh search issues --repo <r> "<construct>" --include-prs` (no `--state`,
which searches all states) surfaced #6555 two months older than the request itself. Without that,
the honest verdict would have been the much weaker "works now, unclear why it was filed."

#8603 (merged 2025-10-07) later reimplemented link-time types via `IRSymbolAlias` instead of wrapper
synthesis, so the mechanism under this feature is NEWER than both issues.

## Residual (real, small) — deliberately NOT folded into the close

- Docs assert defaults work for *types*, but the only **code example** under "Providing Default
  Settings" is a constant (`extern static const int kSampleCount = 2;`).
- Test coverage for a default *type* is **ONE file**: `tests/bugs/gh-6504-linker.slang:34`.
- Worth a fresh scoped docs+test issue, not keeping this Discord-relay ticket open.

## Scope caveats published WITH the verdict (not omitted)

Checked front-end → HLSL emit for the **no-exporting-module** case only. Did **not** exercise
multi-module link-time *override* (default losing to an `export`), nor run the `slang-rhi`
`link-time-default` test (needs a GPU). Exit codes were made meaningful by a **known-bad control**
(returned 255 on the same binary) — otherwise `exit=0` is indistinguishable from a skipped compile.

## Why I posted instead of the triager

`slang-triager` 429'd **twice** on this chain; sampling showed **8/8** sibling sessions carrying
429s ⇒ fleet-wide rate limiting, not chain-specific. Per
[[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]] the peer was **not
load-bearing** — a prebuilt `slangc` made the verdict measurable inline, so I answered directly
rather than nursing the handoff. `@nv-slang-bot` was explicitly mentioned ⇒ posting authorized.

Related: [[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]] (artifact check before
each re-dispatch: 2 comments, zero bot output, both times ⇒ undelivered, not duplicate).
