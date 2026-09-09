---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786446315868-hske8q
written_at: 2026-08-11T11:13:20.096Z
---

# [approver/infra-abstain] devin-fetch.sh (slang copy) died exit 127 — apostrophes in a comment closed the single-quoted DONE_EXPR

# devin-fetch.sh exit 127: a comment's apostrophes terminated the single-quoted DONE_EXPR

**Symptom.** `/home/node/.claude/skills/slang-pr-review-runner/scripts/devin-fetch.sh`
exits **127** within seconds of printing `>>> devin-fetch: rewrote GitHub URL → …`.
It never opens the results page, never polls, and writes **no** `devin-flags.md` and
**no** `devin-error.txt`. Because 127 is not one of the script's documented codes
(2 auth-wall / 3 timeout / 4 browser-launch), a caller matching only those reads the
failure as a generic skip → `DEVIN_SKIPPED` → the review doc loses Devin entirely.
On a PR where Devin is the *only* signal (no harvestable bot review) that is a
manufactured `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`.

**Root cause.** `DONE_EXPR` is a **single-quoted** shell assignment holding a JS
expression. A comment line inside it read:

```
  // Re-probe after every rebuild: grep -c checksSettled / grep -ci 'view results'.
```

The apostrophes around `view results` **close** the `'…'` string early. Bash then
parses the remainder of the JS as a command and dies:

```
devin-fetch.sh: line 118: results.
  const heading = /Devin.s AI analysis/i.test(t);
  … : No such file or directory
EXIT=127
```

Self-referential in the worst way: the comment telling you how to re-probe the guards
is what broke the script.

**Why `bash -n` does NOT catch it.** `bash -n` reports **syntax OK** — the quotes still
balance overall (`'view results'` closes one string and opens another that the trailing
`'` on `})()'` closes). It is a *quoting* bug, not a syntax error, so a syntax check is
the wrong instrument. The failure is only visible at **run** time.

**How to catch it.** Scan the assignment block for stray quotes — expect exactly the two
delimiters:

```bash
grep -n "'" devin-fetch.sh | awk -F: '$1>=98 && $1<=140'
# should print ONLY the DONE_EXPR= opening line and the })()' closing line
```

Also: **treat any exit code outside {0,2,3,4} as a harness defect, not a Devin skip.**
Grep the run log for `EXIT=` and for `line [0-9]*:` — a bash error message in a
"Devin unavailable" log means the script broke before reaching the browser.

**Fix.** Replaced the apostrophes with double quotes and added a warning:

```
  // Re-probe after every rebuild: grep -c checksSettled / grep -ci "view results".
  // Keep this block free of apostrophes: it lives inside a single-quoted shell
  // assignment, and one stray quote ends DONE_EXPR early (bash then runs the
  // remainder as a command and the script dies with exit 127).
```

**Durability warning (in the script's own comments).** This file is **not**
version-controlled — absent from the nanoclaw repo — so **a container rebuild reverts
this fix**. The nanoclaw sibling copy
(`/home/node/.claude/skills/nanoclaw-pr-review-runner/scripts/devin-fetch.sh`, 218 lines)
does **not** contain the offending line and runs fine; the slang copy (362 lines) is the
newer superset (adds the 2026 Bugs/Flags split, Informational category, commit-status
freshness, body-integrity guard). **Re-probe the quote scan after every rebuild**, and
prefer the slang copy once it runs.
