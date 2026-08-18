---
title: "[approver/infra-abstain] devin-fetch.sh page-dump decode is copy-scoped; an escaped dump on disk proves which extractor ran"
type: learning
topic: review-approval
source: learnings/1786117419523-approver-infra-abstain-devin-fetch-sh-page-dump-de.md
---

# [approver/infra-abstain] devin-fetch.sh page-dump decode is copy-scoped; an escaped dump on disk proves which extractor ran

## Symptom

`devin-fetch.sh` reports zero Devin findings while the saved `devin-page.txt`
advertises them. Reported as family-wide ("neither extractor decodes"). Wrong:
it is **copy-scoped**.

- `slang-pr-review-runner/scripts/devin-fetch.sh` (`b95c8fb1fc4cc32b`) **already
  decodes**, at `:215-216` and `:222-224`.
- `nanoclaw-pr-review-runner/scripts/devin-fetch.sh` (`1fc3c69f73ebe522`) had
  **no decode at all** — single write site, line 149.

`agent-browser eval 'document.body.innerText'` emits a **JSON-encoded string**
(leading `"`, literal `\n`). Undecoded, every newline-anchored regex in the
section splitter fails, so the extract reads clean unconditionally.

## The discriminator (the reusable part)

**An escaped `devin-page.txt` on disk proves the decode never ran** — the slang
copy decodes *before* writing, so an escaped artifact can only have come from the
no-decode copy. Escaping *attributes* an artifact to a copy; it is not evidence
about the other copy.

**mtime cannot do this** — both copies share install mtime `2026-07-27 10:51`.
Hash the file and check for a decode stage instead.

Corroborated by complement across two edges, one mechanism: a mixed population
measured 25/44 escaped; an all-slang population measured 0/125 escaped.

## Severity is lower than first reported

All 25 escaped dumps **decode cleanly** with `json.loads` — the dropped findings
are **recoverable from the saved artifacts, not lost**. Historical audits are
re-auditable. (Spot check: an escaped dump decoded to 461 lines and yielded
`0 Bugs / 1 Flag`, matching its independent re-extract.)

## Measure coverage POST-decode

Interim posture — *a Devin zero is uninformative unless the dump carries an
explicit `N Flags`/`No flags` header* — must be measured **after** decoding.
Pre-decode, escaped dumps look header-less and the posture reads far blinder than
it is: one edge went 31/44 post-decode vs. a much scarcer pre-decode count. On an
already-decoded population the delta is 0, so this is a claim about *inputs*, not
a general one — the same shape as the escaping claim itself.

## Fix

```sh
agent-browser eval 'document.body.innerText' 2>/dev/null \
  | python3 -c "import json,sys; raw=sys.stdin.read().strip(); print(json.loads(raw) if raw.startswith('\"') else raw)" \
  > "$OUT/devin-page.txt"
```

Applied in place to the nanoclaw copy (absent from `.external-skills.json` ⇒
local, no external write). The `raw.startswith('"')` test makes it **idempotent**:
verified an already-decoded 1235-line dump passes through at 1235 lines.

**Note the deliberate asymmetry, and don't "tidy" it.** The script runs under
`set -euo pipefail`. The slang copy guards its *informational* decode with
`|| true` but leaves the *page* decode unguarded — verified: malformed JSON makes
python exit nonzero and aborts the script (exit 1). That is the correct direction:
a truncated scrape should **fail loudly**, not fall through to the
`DEVIN_MIN_BYTES:-200` floor, which a sentinel-only extract passes. Adding
`|| true` to the page decode would convert a hard failure back into a silent
false-clean — exactly the bug being fixed.

## Edit survival

`slang-pr-review-runner` and `*-pr-approver` are listed in
`.external-skills.json` (synced from `shader-slang/slang-skills` @ main) —
in-place edits revert **with no failure signal**; durable route is a PR there.
`nanoclaw-pr-review-runner` is absent from the manifest and safe to edit locally.
Check the manifest before editing any skill.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786117419523-approver-infra-abstain-devin-fetch-sh-page-dump-de.md`_
