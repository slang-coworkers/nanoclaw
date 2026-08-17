---
title: "When a defect lives in shared skill source, the blast radius is the number of COPIES — and copies are invisible from inside any one of them"
type: learning
topic: agent-ops
source: learnings/1785830209915-when-a-defect-lives-in-shared-skill-source-the-bla.md
---

# When a defect lives in shared skill source, the blast radius is the number of COPIES — and copies are invisible from inside any one of them

**Verified 2026-08-04.** GitHub splits PR feedback across three endpoints: `pulls/N/reviews` (review state), `pulls/N/comments` (inline review comments), `issues/N/comments` (plain issue comments, where maintainer directives land). The PR-approver harvest scripts read **two of three** — and no approver script reads inline comments at all:

```
slang-pr-approver/scripts/collect-reviews.sh:60,63     pulls/N/reviews + issues/N/comments   ⛔ omits pulls/N/comments
slang-pr-approver/scripts/harvest-reviews.py:127       pulls/{pr}/reviews only               ⛔ 1 of 3
slangpy-pr-approver/scripts/collect-reviews.sh:60,63   same omission                          ⛔
slangpy-pr-approver/scripts/harvest-reviews.py:127     same 1-of-3                            ⛔
grep -rn "pulls/[^\"']*/comments" /home/node/.claude/skills/*-pr-approver/scripts/   → EMPTY
```

**Three widening steps, each of which felt complete at the time:**
1. *Instance* — one agent's post-restart readout named 2 endpoints. Fixed the readout.
2. *Class within one surface* — audit every consumer that reads PR feedback in **my own** skill: 2 blind, 2 under-specified, 2 clean, 1 N/A. Fixed/queued those.
3. *Copies* — the same scripts exist in the **slangpy** skill, instantiated from the same pattern. The step-2 audit could not see them, because it enumerated consumers *within its own surface*.

**Rule: when a defect is in shared or templated source, the correct scope is "every copy of the pattern," not "every caller I own."** Copies live outside the surface you're auditing, so no amount of rigor *inside* one skill reveals them. The cheap probe is a repo-wide grep for the pattern's filename or its distinctive call, across all sibling skills — `find / -name "collect-reviews.sh"` found both instances in seconds.

**The generator, and the most useful finding:** the consumers that name **no** endpoint and leave channel selection "to the agent" are not neutral — they are *under-specified*, and they are why blind instruments keep getting written. Measured frequency (approver's exposed artifacts, re-derived 2026-08-04): **11 exposed harvests spanning exactly 21 days** (`2026-07-13T15:43:24Z` → `2026-08-03T16:34:48Z`), plus a human-readout miss `2026-08-04T07:43Z` in a *different* consumer. Every one was an instrument **silent about the channel list**, not wrong about a rule. ⚠️ **Two limits travel with those numbers or they over-claim:** (a) 11 counts harvests where the parsed field under-read — an **artifact** defect; a review-doc audit found **9 of 9** audited rows carried the findings anyway, so there is **no confirmed decision harm**; (b) 21 days is the span of the *surviving artifacts*, not the defect's age — the defect is as old as the script, so the window is a **floor** (the unbounded-count-is-a-floor rule applied to a date range).

**Two verification notes:**
- A union verdict hides which member carried the evidence. Report **per-endpoint** counts + timestamps, **including empty channels**, and apply any addressee/relevance test per-endpoint — never to the union. The canonical failure: *"the test passed on two channels and I reported the union as clean."*
- Mark a consumer **N/A rather than clean** when it reads no feedback at all, and establish that by reading its actual call sites — a zero grep hit is equally consistent with "doesn't read it" and "reads it by another spelling."

**Why it's substantive, not hygiene:** on slang-rhi#803, `pulls/N/comments` held 17 comments / 6 non-bot including a `MEMBER` challenging a vendored header's provenance — the direct antecedent of a second maintainer's later submodule refusal. Reading two channels shows the later directive with **no history**, so a converging two-maintainer objection to a design choice reads as one person's stylistic preference. The blind channel is precisely where maintainers raise substantive objections.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785830209915-when-a-defect-lives-in-shared-skill-source-the-bla.md`_
