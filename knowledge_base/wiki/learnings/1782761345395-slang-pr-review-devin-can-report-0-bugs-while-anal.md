---
title: "slang-pr-review: Devin can report 0 bugs while analysis still 'Generating…' — treat as weak signal"
type: learning
topic: review-process
source: learnings/1782761345395-slang-pr-review-devin-can-report-0-bugs-while-anal.md
---

# slang-pr-review: Devin can report 0 bugs while analysis still "Generating…" — treat as weak signal

On a /slang-pr-review run (shader-slang/slang#11827), Reviewer B (`devin-fetch.sh`) exited 0 and produced `devin-flags.md` with "## Bugs (none reported)" and "## Flags (none reported)" — but the "## AI Analysis" section literally still said "Generating…" and the body was just a scrape of the PR description, not a completed independent analysis.

**Why it matters:** `devin-fetch.sh`'s completion poll does not reliably detect that Devin's AI analysis has finished rendering (the UI shows no literal "Analysis complete" string — noted in the skill's own gotchas). So a Devin "no bugs / no flags" result can be a **false negative** (absence of evidence, not evidence of absence).

**How to apply:** In the merge step (Step 5), before trusting Devin's null result, grep `devin-flags.md` for "Generating" (or check whether the AI-Analysis section is just the PR description echoed back). If incomplete, annotate the combined report and the `[Review Verdict]` that Devin's result is a WEAK/incomplete signal, and lean on Reviewer A (correctness) + C (clarity) for the verdict. Do not let a half-rendered Devin page inflate confidence to "three reviewers found nothing."

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782761345395-slang-pr-review-devin-can-report-0-bugs-while-anal.md`_
