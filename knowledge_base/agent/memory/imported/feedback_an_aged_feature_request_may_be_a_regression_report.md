---
name: feedback_an_aged_feature_request_may_be_a_regression_report
description: "Before triaging an aged feature request as 'still wanted' or 'already shipped', check whether a REGRESSION of that exact construct was open on its filing date — a feature can look ABSENT because it was temporarily BROKEN"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 77447150-64ee-4e84-9210-058fedaae091
---

# An aged feature request may be a regression report in disguise

2026-08-05, slang#7209 "Default structure for link-time types" (filed 2025-05-22). A maintainer
asked for a relevance scrub. I proved by execution that the requested syntax
(`extern struct Foo : IFoo = FooImpl;`) **works today**, which supports "already implemented" —
but only weakly, because it leaves *"then why was this filed?"* unanswered.

Searching the construct across **all** issue states surfaced **#6555 "link time default error"**:
the same construct failing with `error 45001: unresolved external symbol`, open
**2025-03-10 → 2025-06-25**. **#7209 was filed 2025-05-22 — inside that window.**

⇒ The request was almost certainly *"this is broken"* misfiled as *"please add this."* That reframes
the verdict from "works now, unclear why filed" (weak, invites re-litigation) to "was regressed at
filing time, regression fixed, feature present" (closes the loop).

**Why this is a distinct trap:** the two most natural triage instruments both miss it. Reading the
issue text tells you what the reporter *believed*; compiling the construct tells you the state
*now*. Neither reconstructs the state **on the filing date** — and for an aged ticket that is the
only date that explains the ticket's existence.

**How to apply:**
- ⭐⭐ On any feature request older than a few months, ask: **was this broken when it was filed?**
  `gh search issues --repo <r> "<the construct>" --include-prs` — **omit `--state`**; `--state all`
  is INVALID and errors out (a false zero for a syntax reason, exit != 0 with a usage dump).
  Always pair with a control query that must return hits.
- ⭐⭐ **Verify the feature by DIFFERENTIAL, not by "it compiles."** Vary one token that must change
  the output (here: a default type whose interface constant differs, `-1` vs `2`) and read the
  emitted code. "Exit 0" proves the parser accepted it; only the differential proves the semantics
  are applied. Add a **known-bad control** so a clean exit can't be a silently-skipped compile.
- ⭐ Keep the residual separate from the close. "Feature exists" and "docs/test coverage is thin"
  are different findings; folding them together either blocks a valid close or buries real work.
- ⛔ Don't close another party's endorsed request yourself — recommend, cite the endorsement, name
  who decides.

⚠️ **EVIDENCE BASE: ONE incident.** The mechanism is structural (filing-date state ≠ current state ≠
reporter's belief), but re-derive rather than executing as a recipe.

Related: [[feedback_a_reporters_framing_is_a_hypothesis_not_a_finding]] — same family: the
reporter's framing ("please add") was a hypothesis; the finding was "it regressed."
[[project_7209_link_time_type_default_already_shipped]] holds the chain detail.
