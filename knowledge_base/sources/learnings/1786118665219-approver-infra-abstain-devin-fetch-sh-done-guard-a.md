# [approver/infra-abstain] devin-fetch.sh done-guard accepts the CI-checks panel as a verdict — false-clean, biased permissive (both skill copies)

## Symptom

`devin-fetch.sh` exits **0** with `## Flags` empty (or `(none reported)`) on a page where Devin's findings **never rendered** — they sit behind an unclicked `View results` control, or the panel is still filling ("N lines left"). An empty flags list reads as "Devin found nothing", so the failure is **silent and biased toward the permissive verdict**.

Measured across my own 177 archived `devin-page.txt` artifacts: **22 pages carry no verdict token at all**; 16 of those show `View results` (findings behind a click) and 0 of the 155 healthy pages do — a clean 16/16 vs 0/155 separation.

## Root cause

The done-guard is `heading && summary`, and `summary` accepts a **CI-checks** term as a substitute for a review verdict:

```js
const summary = /\b\d+\s+Bugs?\b/ || /\b\d+\s+Flags?\b/ || /\bNo (bugs|flags)\b/
             || /All checks passed/ || /checks? failed/ || /Checks\s*\d+\s*\/\s*\d+/;
```

`Checks 12/22` is GitHub CI state — it says **nothing** about whether Devin's analysis rendered. Both copies in my tree are affected: `slang-pr-review-runner/scripts/devin-fetch.sh:109` and `nanoclaw-pr-review-runner/scripts/devin-fetch.sh:104`.

The downstream guards do not catch it. The `Generating…` regex misses these pages (they don't say "Generating"), and the 200-byte floor passes easily because `devin-flags.md` embeds the **whole page dump** — nav chrome, file list, diff hunks — so a zero-finding scrape is still multi-KB. **A body-size floor cannot detect a missing verdict when the body is padded with unrelated content.**

## Not the auth-wall variant

The sibling report (slangpy#1095) described an **auth-gated** page: one line of bytes, `Connect GitHub` / `Sign in`. My container is **not** auth-gated — `Connect GitHub` / `Sign in` appear in the navbar of **every** page including all 155 healthy ones, so grepping those markers yields ~100% false positives. Same guard defect, different downstream state. **Do not port the auth-marker grep as the detector.**

## How to catch it

Require a **positive verdict token** — the thing you actually came for:

```bash
grep -qiE '\b[0-9]+ (Bugs?|Flags?)\b|\bNo (bugs|flags)\b' "$OUT/devin-page.txt" \
  || { echo "inconclusive: no rendered Devin verdict token" > "$OUT/devin-error.txt"; exit 3; }
```

Drop the three checks-panel terms from `summary`; a CI panel is not a review verdict. Additionally treat an unclicked `View results` as not-done and click it before scraping.

## Fix / generalization

- **Demand a positive token, never infer from an absence.** An empty findings section plus exit 0 is indistinguishable from a genuine clean review — this is the same shape as the already-known *"EMPTY FINDINGS + EXIT 0 = FALSE CLEAN ⇒ demand a positive token ('N Bugs / M Flags')"* rule. That rule was in my store and I had applied it to **harvested bot reviews**; I had not applied it to **Devin**. A rule proven on one instrument is owed to every instrument of the same shape.
- **A near-miss substitution is the tell.** The guard accepted a token from a *different subsystem* (CI) for the one it needed (review verdict). Any predicate whose accept-set spans two subsystems deserves a look.
- **A byte-count floor is not an integrity check** when the artifact concatenates unrelated content.
