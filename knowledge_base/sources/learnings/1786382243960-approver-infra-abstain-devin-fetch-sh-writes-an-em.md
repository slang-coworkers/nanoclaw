---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-10T17:17:23.960Z
---

# [approver/infra-abstain] devin-fetch.sh writes an EMPTY Flags section when the page reports Bugs — a Flags-only read is a false clean

## Symptom

On slang#12455 the Devin runner (`nanoclaw-pr-review-runner/scripts/devin-fetch.sh`)
exited **0** and wrote `review/devin-flags.md` with a **completely empty Flags
section**. The Devin page itself reported **`2 Bugs / 0 Flags`** — and both bugs
were real (one drove a BLOCK).

An approver reading only the Flags section of that artifact would have scored the
PR clean and lost both findings.

## Root cause

The script splits the captured page on a Flags-count regex
(`/\n\s*\d+\s*Flags?\s*\n/`) and treats everything before the split as narrative
"AI Analysis" and everything after as the findings. Devin renders the **Bugs list
before** the `0 Flags` counter, so the entire Bugs section fell into the
narrative bucket, and the Flags tail — correctly — was empty. Exit 0, no
`devin-error.txt`, no warning. The artifact is *structurally* well-formed and
*semantically* empty.

## How to catch it

- **Demand a positive count token from the page, not from the section.** Grep the
  raw capture (`review/devin-page.txt`) for `[0-9]+ Bugs?` / `[0-9]+ Flags?` and
  compare against what landed in the parsed file. On this PR:
  `grep -oE "[0-9]+ Bugs?|[0-9]+ Flags?" devin-page.txt | sort | uniq -c`
  → `1 "2 Bugs"`, `1 "0 Flags"`. Two bugs claimed, zero present in Flags ⇒ the
  extraction dropped them.
- **`Flags: 0` and `Bugs: 2` are different assertions.** Devin's own severity
  string on those cards was "Potential Bug", and the counter that matters for a
  🔴 is the **Bugs** counter. Never fold Devin's verdict off the Flags section
  alone.
- Recovery: expand each card in the live browser and append the bodies. Keep the
  raw `devin-page.txt` — it is what makes the discrepancy detectable after the
  fact.

## Fix (upstream)

The split should key on the **Bugs** heading as well as Flags, or better, parse
each section by its own heading rather than by one positional split. Until then,
treat a `## Flags` section that is empty **while the page counter is non-zero for
Bugs** as an extraction failure, not a clean review.

## Transferable rule

An empty findings section plus exit 0 is a **false clean** unless the artifact
also carries a positive count token that agrees with it. This is the same class
as the rate-limited review that posts a green status: absence of findings in a
derived artifact is evidence about the *deriver*, never about the code. When two
numbers in the same artifact disagree (page says 2, section shows 0), the one
produced by *my own parsing* is the suspect.
