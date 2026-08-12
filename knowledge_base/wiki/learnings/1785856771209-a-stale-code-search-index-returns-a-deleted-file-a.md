---
title: "A stale code-search index returns a deleted file as current — re-audit the whole batch, not just the challenged claim"
type: learning
topic: verification
source: learnings/1785856771209-a-stale-code-search-index-returns-a-deleted-file-a.md
---

# A stale code-search index returns a deleted file as current — re-audit the whole batch, not just the challenged claim

> ## ⛔ CAUSAL ATTRIBUTION RETRACTED (2026-08-04, by the author — same day as filing)
>
> **Withdrawn:** the claim that the two slangpy#1084 false advisories "were derived from GitHub code search" and "both were false for the *same* reason" (a stale index). **That is wrong, and it was my inference, not the approver's claim.**
>
> **What refutes it:** provenance traced through the approver's own revision reports. Advisory 1 (`ci`/`checks`) originated in a **Devin** diff-scoped investigate-flag at rev-2 and was relayed verbatim rev-2→rev-4; no search was run. Advisory 2 (`ADD_TO_PROJECT_PAT` "now unused") originated in **Devin's rev-4 flag text** (`review-doc.md:44`), passed through without checking the rest of the tree; no search was run. `search/code` was touched exactly **once**, *after* the challenge, while **discharging** the advisory — and the stale hit was **caught and overridden** by a live per-workflow read. The instrument worked as caught-and-corrected; it was never the error's source.
>
> **What actually caused both:** uncritically **forwarding a diff-scoped reviewer's open question as a finding** instead of discharging it. A diff-scoped reviewer (Devin) legitimately cannot see sibling files, so its "verify that X matches" is an *open question*, not a defect — and forwarding it unchanged converts a question into an apparent finding, which N repetitions then read as N confirmations.
>
> **What survives unchanged:** everything below about the *instrument* — a stale index does return a well-formed, plausible, wrong answer with no error signal, and "live read wins; re-audit the whole batch that instrument produced" is a sound rule. It stands on its own merits as a real hazard; it simply did not cause these two errors. Rules 1–4 and the cheap-advisory corollary are all still good.
>
> **The meta-lesson, which is the most transferable thing here:** I filed this while *correcting someone else's* error, and the error I introduced was in the **diagnosis of cause** — the split of fact was right, the causal story was not. Predicting that "a third error is likeliest inside the correction" did not stop me from being the one to make it. **A correct fact plus a wrong cause files a true-but-unrelated rule against the wrong root cause, and leaves the real one under-weighted** — which is worse than filing nothing, because it looks like the lesson was learned. **Verify provenance separately from verifying the fact; "same root cause" is a claim needing its own evidence, not a summary.**

# A stale code-search index returns a deleted file as current

**Observed:** slangpy#1084 (2026-08-04) — ⚠️ **but see the retraction above: this hazard is real and was *encountered* here, yet it did NOT cause the two false advisories originally attributed to it.** The stale index returned `.github/workflows/add-pr-to-project.yml`, which the PR had **deleted**, when the approver ran a single `search/code` call while discharging an advisory. The approver caught it and overrode it with a live per-workflow read. Treat what follows as a rule about the instrument, illustrated by a caught near-miss — not as a post-mortem of those advisories (their cause was forwarding a diff-scoped reviewer's open question as a finding).

The two advisories, for the record, and how each was actually resolved:

- Advisory 1 (`ci`/`checks` `workflow_run` name-match won't fire) — false. `ci.yml:1` = `name: ci`, `checks.yml:1` = `name: checks`. Discharged by reading two sibling files. **Origin: Devin flag, relayed 4×.**
- Advisory 2 (`SLANGBOT_MEMBERS_READONLY` **and** `ADD_TO_PROJECT_PAT` both now unused) — half false. `ADD_TO_PROJECT_PAT` is still the sole auth for `sync-issues-to-project.yml`; acting on the advice would have broken issue→project sync. **Origin: Devin rev-4 flag text, passed through unchecked.**

**Why this instrument fails silently:** a stale index returns a *well-formed, plausible, wrong* answer. There is no error, no empty result, nothing that looks like a failure at the call site — same family as a shallow clone answering `merge-base --is-ancestor` with a confident FALSE, or `gh --paginate` returning a page and looking like a population.

**Rules:**

1. **When a search index and a live read disagree, the live read wins.** Confirm existence with a live contents read before treating a file's body as current — especially right after a PR that deletes files.
2. **A challenged claim is never the only casualty.** Re-audit *every* claim that instrument produced in the same batch, not just the one someone pushed back on. Here the challenge was aimed at advisory 1; advisory 2 was wrong too and nobody had questioned it.
3. **Absence claims are scoped to the tree you actually read.** `0 references` in repo A says nothing about a reusable workflow living in repo B (`uses: owner/repo/.github/workflows/x.yml@ref`). The escape hatch closes only if the caller passes secrets *explicitly* rather than `secrets: inherit` — check which, and say which tree you enumerated.
4. **Code references ≠ settings state.** "No workflow references this secret" is not "this secret does not exist." The contents API cannot see repo/org secret settings; do not upgrade one claim into the other.

**Cheap-advisory corollary (the reason this mattered):** on a verdict that short-circuits (e.g. an ABSTAIN on a deterministic clause), the advisory list *is* the report's entire informational value to the human. Both false advisories were resolvable in seconds. An advisory cheap to discharge should be **discharged, not forwarded** — and N repetitions of an unresolved flag read as N confirmations to whoever inherits the report. Asymmetry worth holding: uncertainty on a *gating* question ⇒ abstain; uncertainty on a *non-gating advisory* ⇒ go look.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785856771209-a-stale-code-search-index-returns-a-deleted-file-a.md`_
