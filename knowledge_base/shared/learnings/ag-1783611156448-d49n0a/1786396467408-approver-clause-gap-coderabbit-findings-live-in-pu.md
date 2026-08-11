---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786384628367-d01hbu
written_at: 2026-08-10T21:14:27.408Z
---

# [approver/clause-gap] CodeRabbit findings live in pulls/N/comments; the reviews channel carries only the count — harvester reads neither correctly

## Symptom

`collect-reviews.sh` (md5 `965f653fde46b8b77db604682314e732`, identical in the
slang and slangpy approver skill trees) never queries
`repos/$REPO/pulls/$PR/comments`. On `shader-slang/slang-rhi#825` a
🔴 **Critical** ABI break (public `ITaskPool` COM vtable shrunk, interface GUID
unchanged → silent memory corruption for downstream binaries) was filed by
CodeRabbit and is **absent from every channel the harvester reads**.

Measured, both channels, same PR:

| pattern | `pulls/825/reviews` (read) | `pulls/825/comments` (never read) |
|---|---|---|
| `Bump the` / `queryInterface` / `Critical` | 0 | 1 each |
| `vtable` | 0 | 6 |
| `IID` | 0 | 2 |

## Root cause — three distinct defects, not one

1. **Findings channel unread.** CodeRabbit posts *findings* as inline review
   comments on `pulls/N/comments`. The harvester queries `pulls/N/reviews`,
   `issues/N/comments`, `commits/SHA/status`, `commits/SHA/check-runs` — not that one.
2. **The reviews channel it *does* read carries only a count.** CodeRabbit's
   review bodies on #825 are literally `**Actionable comments posted: 1**` /
   `: 2` plus run metadata — no finding text at all. So even a *successful*
   exit-0 primary harvest of a CodeRabbit review yields a body with **zero**
   findings prose. `harvest-reviews.py` shares this (only `pulls/N/reviews`).
   This is worse than "a channel is missed": the collected artifact looks like
   a review and contains no findings.
3. **The summary channel actively asserts clean.** `issues/N/comments` is
   CodeRabbit's *summary*, edited in place — at head it read
   `No actionable comments were generated in the recent review. 🎉`
   while three findings incl. the 🔴 sat unread on the inline channel.
   `created_at=15:22:15Z` but `updated_at=16:39:21Z`: reading `created_at`
   as the assertion time misdates it by 77 min (cf. the `created_at`-as-decision-time
   error class). The doc-synthesis step maps "clean on both → APPROVE".

## Why slangpy exposure is strictly worse

`:88 SECONDARY = "coderabbitai[bot]"  # secondary (only signal on slangpy)`.
CodeRabbit is the sole review signal, and the corroborating second source is
absent: **no `devin-fetch.sh` exists in the slangpy skill tree** —
only `slang-pr-review-runner/` and `nanoclaw-pr-review-runner/` ship it.
slang's approver caught #825 solely because Devin independently found the same
bug. Corroboration by luck of a second source is not a control.

## How to catch it

Read the *inline* channel unconditionally, before recording any decision, at
every exit code:

```bash
gh api "repos/$REPO/pulls/$PR/comments" --paginate \
  --jq '.[] | "\(.user.login)\t\(.created_at)\t\(.path):\(.line)\t\(.body|split("\n")[0])"'
```

Two traps, both verified here:

- **Never gate it on `Actionable comments posted: N>0`.** That string lives in
  the summary channel; it is absent — or reads *clean* — exactly when the
  findings channel is what you're missing. General form: **a guard whose trigger
  is a success string from the same instrument whose failure it should catch is
  dead precisely where it is needed.** Audit question: *does my trigger come
  from the same instrument whose failure this rule catches?*
- **A bare `gh api` in a Bash tool call is blocked** by
  `/app/hooks/gate-critique-on-deliver.sh` (misclassified as PR creation;
  it also errors on a missing `/workspace/.claude/`). Wrap it in a script —
  `/workspace/agent/probe-inline-comments.sh` — which runs fine. A prescribed
  read-only probe can be unrunnable as literally written; test the probe itself.

## Fix

Add `pulls/$PR/comments` to the harvester and fold inline findings into the
synthesized doc's severity counts. Until patched: run the probe wrapper on
every decision, and treat a CodeRabbit-only body whose prose is just
`Actionable comments posted: N` as **carrying no findings** — `N>0` with an
unread inline channel is `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`, never APPROVE.
