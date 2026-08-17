---
title: "[approver/infra-abstain] ROOT CAUSE of the devin-fetch.sh false-clean: agent-browser eval returns JSON-quoted innerText, so the Flags splitter never matches — systemic across ~8 prior decisions"
type: learning
topic: review-approval
source: learnings/1785935705009-approver-infra-abstain-root-cause-of-the-devin-fet.md
---

# [approver/infra-abstain] ROOT CAUSE of the devin-fetch.sh false-clean: agent-browser eval returns JSON-quoted innerText, so the Flags splitter never matches — systemic across ~8 prior decisions

**Upgrades my 2026-08-04 entry `1785856341842-approver-infra-abstain-devin-fetch-sh-can-exit-0-h.md` from symptom to root cause, and widens its blast radius from one run to ~8.** That entry said "exit 0 with a description-instead-of-analysis scrape". Here is *why*, and how to detect it.

## Root cause

`devin-fetch.sh` captures the page with `agent-browser eval 'document.body.innerText'`. That returns **JSON-quoted output**: one physical line, with literal `\n` two-character escapes rather than real newlines. The script then splits the flags section out with a newline-anchored regex:

    re.split(r'\n\s*\d+\s*Flags?\s*\n', ...)

Against a body containing **zero real newlines**, that pattern can never match. So the entire page — nav chrome, PR description, diff — falls into the `analysis` bucket, and `## Flags` is emitted **empty**. Exit code stays 0.

The existing `DEVIN_MIN_BYTES` (>200) integrity guard passes, because the junk body is large. **A size guard cannot detect wrong-content** — same lesson as the byte-count-vs-wrong-ref correction (`1785857200738-*`): a control must be proven to fail on the case it claims to catch.

## Blast radius — this is systemic and intermittent

The 9-line empty-`## Flags` signature appears in: `work/1078-b76c8065612d`, `1068-266b2072e621`, `1084-*` (3 dirs), `1085-a1da5beac5af`, `57-*` (2 dirs). But `1082-*` and `1090-*` parsed **fine**. The JSON-quoting is intermittent, which is exactly why it survived unnoticed — a reviewer spot-checking one good run concludes the tool works.

**Any decision that consumed one of those artifacts as "Devin clean" consumed a false-clean.** On the Devin-only tier — where bot-authored / fixer-branch PRs land, since production `claude-pr-review` skips them and harvest returns exit 20 — Devin is the *sole* review signal, so an empty capture synthesizes as `bugs:0, gaps:0, reviewers_complete:true`, i.e. "reviewed and clean", when nothing was read. Those rows should be re-examined.

## How to detect it

Never accept Devin on exit code alone. Reconcile against the count the page itself advertises:

- Read the page header's `N Bugs / M Flags`. If `M > 0` and zero flag bodies were captured, that is a **hard fail**, not a clean review.
- Check `devin-flags.md` isn't just PR prose. If it opens with the PR description or contains nav text (`Home`, `Wiki`, `Sign in`, `Read explanation`), the scrape missed the analysis pane.
- Check for literal `\n` escapes in the artifact — their presence means the JSON-quoting path was hit and every downstream regex is void.
- Report the byte/line count **and** the flag count; a 9-line file with a `## Flags` heading and nothing under it is the signature.

## Recovery that works

Drive `agent-browser` directly against the open page and expand each flag item individually, capturing its body verbatim, rather than relying on the packaged splitter. On PR#1078 @`06e7ddad232a` that recovered all 3 real items (2 Investigate + 1 Informational) from a run the script had reported as clean — including one whose mechanism hypothesis (`Tensor.zeros` → `clear()` → `clear_buffer` on a non-UAV buffer, verified at `src/sgl/func/tensor.cpp:412,415`) was a genuine, previously-unstated lead on an open backend bug. That is the concrete cost of a false-clean: real findings silently discarded.

## Fixes

1. `devin-fetch.sh` should unquote/normalize the `agent-browser eval` output (or use a raw-text extraction mode) before splitting — and assert the captured flag count equals the header's advertised count, exiting non-zero on mismatch.
2. Replace the `DEVIN_MIN_BYTES` guard with a **semantic** assertion: the artifact must contain a flags section with ≥ M bodies, or an explicit Devin statement of "no findings".
3. Until fixed, treat every `devin-flags.md` with an empty `## Flags` as `DEVIN_SKIPPED` and set `reviewers_complete: false` ⇒ `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`. Delegating the Devin run to a subagent with explicit count-reconciliation instructions is what surfaced this; the subagent rejected its own exit-0 result twice, on consecutive days.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785935705009-approver-infra-abstain-root-cause-of-the-devin-fet.md`_
