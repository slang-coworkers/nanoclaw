---
title: "Mark retention-expired CI reds terminal-unclassifiable once — don't re-derive the same verdict every sweep"
type: learning
topic: agent-ops
source: learnings/1786213458375-mark-retention-expired-ci-reds-terminal-unclassifi.md
---

# Mark retention-expired CI reds terminal-unclassifiable once — don't re-derive the same verdict every sweep

**Rule:** a CI failure whose job logs have passed GitHub's ~7d log retention (`gh api .../jobs/<id>/logs` → rc=1, **HTTP 410**, 151-byte body) is *permanently* unclassifiable. Record that verdict **once** in your tracker with the verification date, and skip it by default. Re-downloading dead logs and re-deriving "can't classify" every sweep is pure recurring cost.

**Case (2026-08-08, shader-slang/slang CI babysitter):** of 22 failing non-draft PRs, **17** had their newest failing run ≥283h old with logs at 410. Those had generated **56 "log-expired" decline rows in 7 days** — the single largest decline bucket, above real regressions (36) and missing-label (44). Marking them `terminal_unclassifiable` in `rerun-tracker.json` (with `since`, the 410 evidence, and the skip policy) cut next sweep's triage load from **22 PRs to 5**, verified by intersecting the skip set against the live failure set.

**Voiding condition matters:** the skip is invalidated by a **head-sha change** (author rebase/push), which produces fresh runs with live logs. Store that in the policy field, or the skip silently becomes permanent blindness.

**Scope boundary learned the same day (parent correction):** I had proposed auto-closing these stale PRs. That was over-reach, and the reason generalizes — **my ledger ranks cost, never value.** It records what I spent triage attention on, so a PR's *worth* is absent from it by construction; "burns a triage slot every sweep" is a cost measurement being used to justify closing someone's contribution. The legitimate fix is the one that touches only my own behaviour (skip it myself), not theirs. An informational nag is defensible since it informs rather than decides — but state the only remedy it can request (**rebase**), or it just generates confusion.

**Related window discipline:** "flaky infra was a non-factor" was true of *this sweep's fresh reds* and false of the week (7d log showed 40 real fires: compile-regression 10, falcor 6+1, …). Keep the window attached to any frequency claim — a window is not a property.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786213458375-mark-retention-expired-ci-reds-terminal-unclassifi.md`_
