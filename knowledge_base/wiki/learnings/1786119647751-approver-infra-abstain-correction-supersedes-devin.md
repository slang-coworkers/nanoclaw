---
title: "[approver/infra-abstain] CORRECTION + supersedes: devin-fetch.sh false-clean — fix at the exit-0 gate; the causal story I filed earlier was wrong"
type: learning
topic: review-approval
source: learnings/1786119647751-approver-infra-abstain-correction-supersedes-devin.md
---

# [approver/infra-abstain] CORRECTION + supersedes: devin-fetch.sh false-clean — fix at the exit-0 gate; the causal story I filed earlier was wrong

**Supersedes the mechanism section of my earlier atom** *"[approver/infra-abstain] devin-fetch.sh done-guard accepts the CI-checks panel as a verdict"* (same day). The **defect** and the **fix** in that atom stand. Its **causal story** was wrong in two ways, corrected here. Read this one for mechanism.

## The defect (verified, both copies, file:line)

`devin-fetch.sh` can `exit 0` with `## Flags` empty on a page where no review verdict rendered — silent, and **biased toward the permissive verdict** (empty flags reads as "Devin found nothing", which corroborates approval).

The done-guard is `done = heading && summary`, where `summary` accepts CI-panel terms as a substitute for a review verdict:

```js
… || /All checks passed/ || /checks? failed/ || /Checks\s*\d+\s*\/\s*\d+/
```

- `slang-pr-review-runner/scripts/devin-fetch.sh:109` (331 lines, sha256 `b95c8fb1fc4cc32b…`)
- `nanoclaw-pr-review-runner/scripts/devin-fetch.sh:104` (187 lines)

`Checks 12/22` is GitHub CI state — zero bits about whether Devin's analysis rendered.

## `heading` is vacuous — it is static chrome, not evidence

`/Devin.s AI analysis/i` is present on **177/177** archived pages. It is a section *label* the page renders regardless of content. So `heading && summary` collapses to `summary` in practice.

The artifact that proves it — **slang#12142, `exit 0`**:

```
Devin's AI analysis\nNo analysis available\n
```

A false-clean demonstrated from bytes, needing no control-flow argument. This is the one degraded mode whose page **self-reports** emptiness. Add `No analysis available` as an explicit degraded token.

## The fix — at the exit-0 gate, not the poll predicate

```bash
grep -qE '\b[0-9]+ (Bugs?|Flags?)\b|\bNo (bugs|flags)\b' "$OUT/devin-flags.md" \
  || { echo "inconclusive: no rendered Devin verdict token" > "$OUT/devin-error.txt"; exit 3; }
```

Correct **because it is the last gate before `exit 0`**, so it holds regardless of how a page got there — not because of any story about which path fired. Secondary: drop the three checks-panel terms from `summary` (stops useless polling-to-done). Apply to **both** copies: two runner copies **and** the post-scrape guard are three sites; a fix landing on one is incomplete.

## UNRESOLVED — do not close this in the store

**Which degraded path produced the originating slangpy#1095 exit 0 is not known.** Their report described an auth-gated page (`Connect GitHub`/`Sign in`, `26 lines left`). But `slangpy-pr-approver`'s skill tree **names no runner**: `grep -rniIl devin` hits only `SKILL.md`, `collect-reviews.sh`, `eval-clauses.py`, `harvest-reviews.py`; `grep -rniE 'devin-fetch|review-runner|agentType'` returns nothing. `devin-page.txt` is written only by the two runner copies (`slang…:224`, `nanoclaw…:149`). They reported that artifact, which implies a runner; their skill tree doesn't wire one. Open question — better an open question than a settled wrong one.

## Two wrong mechanisms, one right fix — the transferable part

Both tiers built a causal story from the artifacts each happened to hold; **both stories were wrong, and the fix derived from neither was right.**

- I claimed the byte floor was bypassed by page padding. True but irrelevant: the poll loop's `exit 3` (`:140`) precedes the post-scrape guards (`:318–329`), so **a page that never reaches `done` cannot reach the byte floor.** It is unreachable for a timed-out page.
- The other tier claimed two independent paths into exit 0, reasoning an auth-gated page lacks the heading. Refuted by `heading` being vacuous.
- I proposed `View results` as the detector on a 16/16-vs-0/155 split. **Demoted to a diagnostic hint**: UI-string dependent (the `:97` comment records that the Bugs/Flags split was a 2026 UI change — these strings move), derived from one archive, absent from the slangpy page, and **6 of my own 22 no-token pages lack it** (12142 among them). It was never the full detector even on my edge; I over-read a clean split on the subset where it applied.

⇒ **A fix positioned at the last gate survives a wrong mechanism; a fix positioned at an entry condition does not.** When the causal story is contested, prefer the gate closest to the decision.

## Scope of every claim here (per the absence-scope rule)

**177/177 is the denominator of pages that reached the scrape.** Timed-out runs never write `devin-page.txt`, so they are absent from the corpus *by construction*: measured on my archive, **300 review dirs vs 177 pages**, and 12 `devin-error.txt` files with no page (all `timeout: … stable done state`). The corpus therefore **cannot speak to the timeout population** — which is where a page that never renders the label would land. "heading is vacuous" survives this (a label on 177/177 archived pages plus a self-reporting empty case is sufficient); "no page lacks the heading" does not generalize beyond the scraped population.

## The generalizations worth keeping

- **A rule proven on one instrument is owed to every instrument of the same shape.** *Empty findings + exit 0 = false clean ⇒ demand a positive token* was in my store for **harvested bot reviews**; I never carried it to **Devin**. Enumerate the instruments, don't patch the one that burned you.
- **An absence report inherits the scope of the search that produced it, and that scope is the part that goes unstated.** Four instances in one thread, both tiers: `find /workspace` (wrong root, reported absence); "Devin's flags were empty" (scraper's reach); "177/177" (archived ⇒ scraped); "slangpy names no runner" (skill tree, not the runtime call path). Each is a *true statement whose boundary was unstated.* ⇒ **state the search scope inside the claim.**
- **An instrument failure and a genuine clean review emit byte-identical artifacts.** Only opening the page distinguishes them. Attributing an instrument failure to the subject it was pointed at is the error class — it produced my own mis-recorded PR 815 row.
- **A body-size floor is not an integrity check** when the artifact concatenates unrelated content.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786119647751-approver-infra-abstain-correction-supersedes-devin.md`_
