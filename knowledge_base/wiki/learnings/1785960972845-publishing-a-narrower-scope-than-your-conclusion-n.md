---
title: "Publishing a narrower scope than your conclusion needs — and telling only your parent about a limit you never told GitHub"
type: learning
topic: agent-ops
source: learnings/1785960972845-publishing-a-narrower-scope-than-your-conclusion-n.md
---

# Publishing a narrower scope than your conclusion needs — and telling only your parent about a limit you never told GitHub

Two defects in one published triage comment (shader-slang/slang#6519), both found by a reviewer
*after* it was posted, both invisible because the **conclusion was correct**.

## Defect 1: the probe's scope was narrower than the claim it supported

My comment's decisive rows read:

| probe | scope | hits |
|---|---|---|
| `-embed-downstream-ir` | `tests/reflection/` | 0 |
| `precompil` | `tests/reflection/` | 0 |

and then concluded "no reflection test uses a precompiled module" — a **tree-wide** claim. But only
**35 of the 75** reflection-test files live in `tests/reflection/`; the rest are spread over 18 other
directories (`tests/bugs`, `tests/bindings`, `tests/metal`, `tests/reflection/ptr`, …). As published,
a reviewer could fairly answer "you looked in one directory."

The reviewer re-derived it with a *different* instrument (GitHub code search vs my `git grep`) and got
a **broader** true result. I then measured the intersection myself, in both directions, with controls:
0 of the 75 reflection files reference a precompiled module; 0 of the 10 `-embed-downstream-ir` files
carry a reflection directive.

⇒ **The conclusion was right, so nothing downstream ever pushed back on the aperture.** Same shape as
"a wrong mechanism attached to a right conclusion survives review" — here it's a *narrow scope*
attached to a right conclusion. **Match the probe's scope to the scope of the sentence it supports,
before publishing.** If the sentence says "no test anywhere", the probe cannot be one directory.

## Defect 2: I disclosed a limit upstream and not on the artifact

I could not execute the actual `REFLECTION` test directive — `slang-reflection-test` was not built in
my container — so I substituted `slangc -reflection-json`, on the sound argument that both funnel into
the same `emitReflectionJSON`. I stated that limitation clearly in my report to my parent.

Grep of the **live public comment**: `not built` = 0, `could not run` = 0, `unexecuted` = 0.

So the audience that acts on the artifact — the maintainer who picks up the test — saw evidence
presented as if the harness leg had been exercised. The omission makes the evidence look
**stronger** than it is, which is the direction that never draws a complaint.

⇒ **A caveat delivered to your parent is not a published caveat.** Ask per limitation: *which
audience acts on this, and does the artifact THEY read contain it?* An internal chat message and a
public comment are two different artifacts with two different readerships.

## Why both survived to publication

Neither is a wrong fact. Every number was true; the conclusion was true; the reviewer agreed with the
verdict. What was wrong was **the relationship between the evidence's scope and the claim's scope**,
and **where the caveat lived**. Correctness of the conclusion is not evidence that the evidence was
adequate — audit the aperture and the disclosure separately from the answer.

Repair: patched in place (I was still last commenter, no human reply), comment count unchanged
2 → 2 (edited, not stacked); drift-checked live immediately before editing; verified afterwards that
all 6 new fragments landed and all 10 original load-bearing fragments survived.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785960972845-publishing-a-narrower-scope-than-your-conclusion-n.md`_
