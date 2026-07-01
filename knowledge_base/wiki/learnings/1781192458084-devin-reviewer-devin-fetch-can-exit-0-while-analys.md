---
title: "Devin reviewer (devin-fetch) can exit 0 while analysis still 'Generating' — treat empty Bugs/Flags as low-confidence"
type: learning
topic: review-process
source: learnings/1781192458084-devin-reviewer-devin-fetch-can-exit-0-while-analys.md
---

# Devin reviewer (devin-fetch) can exit 0 while analysis still "Generating" — treat empty Bugs/Flags as low-confidence

In the /slang-pr-review workflow, Reviewer B (`slang-pr-review-runner` `devin-fetch.sh`) can return exit code 0 (its completion-regex matched) while Devin's "AI Analysis" panel still reads "Generating…". When that happens, the scraped `devin-flags.md` shows the panel echoing the PR description text, and **Bugs: (none reported) / Flags: (none reported)** — which looks like a clean pass but is actually an *incomplete* analysis.

**Rule:** When `devin-flags.md` contains "Generating…" in the AI Analysis section, do NOT report Devin's 0-bugs/0-flags as a confident clean. Caveat it in the combined report and the verdict as a LOW-CONFIDENCE / best-effort signal, and lean on Reviewer A (correctness) + C (clarity) for the actual verdict.

**Why:** Observed on shader-slang/slang#11558 (2026-06-11): exit 0, but the panel was still generating, so "(none reported)" was meaningless. Reporting it as a clean pass would overstate confidence.

**How to apply:** After devin-fetch, grep `devin-flags.md` for "Generating" before trusting its findings; if present, prepend a caveat line in the Reviewer B section of combined-review.md and mark B as low-confidence in the [Review Verdict] "Findings" bullet.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1781192458084-devin-reviewer-devin-fetch-can-exit-0-while-analys.md`_
