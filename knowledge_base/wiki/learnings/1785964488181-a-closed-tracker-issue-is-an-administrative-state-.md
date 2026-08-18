---
title: "A closed tracker issue is an administrative state, not a coverage measurement"
type: learning
topic: misc
source: learnings/1785964488181-a-closed-tracker-issue-is-an-administrative-state-.md
---

# A closed tracker issue is an administrative state, not a coverage measurement

Triaging shader-slang/slang#7672 (a departing-owner scrub), I found a successor programme — issue #7723 "cuda test enablement burndown tracker", `state_reason=completed`, executed as ten batch issues #8077–#8086, **all closed**, via merged PRs. I drafted the verdict "superseded by a completed programme → recommend CLOSE".

**That was wrong.** Of #7723's 57 distinct `tests/compute` paths, at HEAD today only **18** have CUDA enabled — **31 still have no CUDA directive at all**. The ten batch bodies show **94 of 154 boxes ticked, 60 unticked**, with nine of ten batches closing on unticked items. The programme closed at ~61%.

⇒ **Closure and coverage are different nouns.** A tracker gets closed when the humans stop working it, not when the checklist empties. Before writing "superseded by X", measure X's *effect on the artifact*, not X's status field. Had I published it, a maintainer would have closed a materially unfinished ask on my word.

**Why the gap survived unnoticed for a year:** in slang-test, a `-cuda` test with no CUDA device is **Ignored, not failed** (`_canIgnore`, `tools/slang-test/slang-test-main.cpp:4908-4949`; `isEnabled == false` → ignore), and a file with no `-cuda` directive is never asked to run on CUDA at all. So absent coverage is *silent*, never red — CUDA CI stays green either way. Missing coverage has no failure signal; only a census finds it.

**A related noun collision, both parties right:** I measured "154 items, 0 ticked" — true of a **comment** on #7723. The reviewer measured "94 of 154 ticked" — true of the **ten batch bodies**. #7723's own **body** has zero checklist lines. Three artifacts, three answers. My sentence attributed the batch checklist to #7723 and so misrepresented live state. **State which artifact a count came from**; "the issue's checklist" is ambiguous when a tracker has a body, comments, and children.

**Also worth knowing before reassigning:** the unticked remainder was not all unfinished work. The batch issues carried explicit reasoned skips ("atomic ops are not supported on CuSurfObjects", "cuda doesn't support Multi sampling", "inline raytracing is not supported by optix/cuda"). So a residue count mixes *not yet done* with *cannot be done on this target* — and separating those two is usually the actual deliverable of a rescope.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785964488181-a-closed-tracker-issue-is-an-administrative-state-.md`_
