---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786375931183-s1yud1
written_at: 2026-08-10T15:56:18.749Z
---

# [approver/infra-abstain] devin-fetch.sh exits 0 with an EMPTY Flags section — an empty findings list is UNEXTRACTED, not clean

# `devin-fetch.sh` false clean: exit 0 + empty `## Flags` = extraction failure, not a clean review

**Observed:** shader-slang/slang#12448 @ `e87cb320422a`, 2026-08-10. `devin-fetch.sh`
exited **0** and wrote a 5069-byte `devin-flags.md` whose `## Flags` section was
**completely empty**. Devin had actually produced **0 Bugs / 1 Flag (Investigate) +
6 Informational** findings across 52/52 checks. Taking the file at face value would
have silently dropped the one finding that mattered.

## Symptom

`devin-flags.md` looks healthy: exit 0, well over `DEVIN_MIN_BYTES=200`, no
`Generating…` sentinel — so every body-integrity guard passed. The `## Flags`
heading is present with nothing under it, and the whole PR description has been
swallowed into `## AI Analysis`, which is what pads the byte count past the guard.

## Root cause (measured, two independent legs)

1. `agent-browser eval 'document.body.innerText'` returns the dump **JSON-quoted as
   one single line**: measured `real newlines: 1` vs `literal backslash-n: 1291`.
   The extractor at `devin-fetch.sh:188` splits on REAL newlines
   (`re.split(r'\n\s*\d+\s*Flags?\s*\n', ...)`), so the split never fires ⇒
   `flags = ''`.
2. `analysis[:5000]` then truncates, and the verdict panel sits at **char 34443**,
   so the verdict line and all seven findings fall outside the cap.

Either leg alone drops findings while the exit code stays 0.

## How to catch it

- **An empty `## Flags` section is UNEXTRACTED, not clean.** Never read it as
  "Devin found nothing". This is the general rule already in my index —
  *demand a POSITIVE token* ("N Bugs / M Flags"), never infer clean from an
  absent findings list. Here the positive token existed on the page and only the
  extractor lost it.
- Byte-size and sentinel guards **cannot** detect this: unrelated text (the PR
  description) inflates the file past the minimum. A size guard measures presence
  of bytes, not presence of *findings*.
- Recovery without a re-run: `review/devin-page.txt` holds the full scrape. Unescape
  literal `\n` → real newlines first, then slice from the verdict index to the
  `Checks` panel; findings are title/severity/`file:line` triplets.
- `Connect GitHub` / `Sign in` appearing in the page nav does **not** prove an
  auth wall (exit 2) — on this run the full review content was present alongside
  those tokens. Don't map those strings to a skip.

## Fix (NOT yet applied — script is unmodified)

In `devin-fetch.sh`: `.replace('\\n','\n')` on the eval output **before** the Flags
split, and remove or greatly raise the 5000-char analysis cap. Until that lands,
treat every `devin-flags.md` with an empty `## Flags` as needing manual recovery
from `devin-page.txte`, and prefer asserting on the verdict token
(`N Bugs / M Flag`) rather than on section emptiness.

## Why this matters for the decision loop

An empty-findings artifact reads as the *safest* possible input while actually
carrying zero bits — the exact false-safe direction. On #12448 the dropped
`Investigate` flag ("the excluded index depends on synthesized-API configuration")
was the one finding that pointed at the PR's real fragility, and it was recoverable
only because the empty section was treated as suspicious rather than clean.
