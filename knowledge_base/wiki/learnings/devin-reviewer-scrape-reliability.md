---
title: "Devin reviewer scrape reliability"
type: learning
topic: review-process
source: learnings/devin-reviewer-scrape-reliability.md
---

# Devin reviewer scrape reliability

The Reviewer B step in `/slang-pr-review` (Devin Review at `app.devin.ai/review/...`, fetched via `slang-pr-review-runner devin-fetch` / `scripts/devin-fetch.sh`) has two known failure modes that produce a passing scrape with garbage content. Treat Reviewer B as **best-effort and self-verify** before counting it toward an A/B verdict.

## Failure mode 1 — premature scrape (page rendered, analysis still generating)

The page is reachable long before Devin's AI analysis is done. Initially it renders a `Generating...` placeholder where the AI Analysis will appear; the `Flags` section is empty. If you snapshot the page in this state, `devin-flags.md` literally contains `Generating...` (sometimes with a partial diff fragment) and an empty Flags section. The verdict you ship then looks dual-reviewer but is effectively single-reviewer.

Observed on shader-slang/slang#11167 (2026-05-15).

**Detection signals:**
- `Generating...` appears anywhere in the saved file.
- `## AI Analysis` is shorter than a few sentences of synthesized prose, or is just raw diff/page text.
- `## Flags` is empty whitespace rather than an explicit "no flags" line.

**Mitigation:**
- Poll the page until the `Generating...` indicator is gone. The shipped `Analysis complete` heuristic in `devin-fetch.sh` is not sufficient — verify content after.
- Devin can take 5–15 min on a non-trivial PR. Poll every ~30s up to ~20 min before giving up.
- On timeout, mark Reviewer B as `skipped — Devin still generating after <N> min` in the 5-bullet `[Review Verdict]`. Do **not** attach the placeholder to the upstream report.

## Failure mode 2 — cross-PR contamination on concurrent runs

When dispatching Reviewer B for **multiple PRs in parallel**, the agent-browser-driven scrape can return identical contaminated content across all `devin-flags.md` files even though `devin-fetch.sh` exits 0 on each.

Observed on 2026-05-20 running three reviews concurrently for shader-slang/slang #11195, #11202, #11203:
- All three `devin-flags.md` contained the same `## AI Analysis` blob — and that blob was PR #11203's description, not the requested PR's.
- All three `## Flags` sections were empty.
- Each `devin.log` showed `✓ Devin Review` on the correct URL — navigation succeeded; the page state captured at scrape time held content from a sibling tab.

The contamination is hard to spot: the markdown is well-formed; only reading the body reveals the wrong PR number embedded inside.

**Mitigation:**
- Before trusting `devin-flags.md`, grep for the expected PR number inside the AI Analysis blob. If it doesn't match the URL fetched, mark Reviewer B skipped for that PR.
- Or serialize Devin fetches: dispatch Reviewer A in parallel (safe), but run `devin-fetch.sh` calls one at a time with a small gap so each scrape sees its own stable page state.

## Concrete signal — what a good Devin scrape looks like

- `## AI Analysis` section with at least a few sentences of synthesized prose (not diff fragments, not page chrome).
- `## Flags` section that either lists flags or explicitly says "no flags" — not empty whitespace.
- The PR number/URL inside the analysis text matches the PR being reviewed.

If any of these fail, treat Reviewer B as skipped and report `B: skipped — <reason>` in the verdict. Reviewer A's findings stand alone — never present a placeholder or contaminated blob as if Devin participated.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/devin-reviewer-scrape-reliability.md`_
