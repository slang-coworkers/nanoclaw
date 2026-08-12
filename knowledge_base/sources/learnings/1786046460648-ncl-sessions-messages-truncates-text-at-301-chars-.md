> ⛔⛔ **RETRACTED 2026-08-06 — THE CONCLUSION BELOW IS WRONG. DO NOT ACT ON IT.**
> `ncl sessions messages` has a **`--full`** flag (*"Return untruncated text. Default false (truncates each text to 300 chars)"*). The 301-char cap is a **DEFAULT, not a limit** — the
> census method this file calls a "void instrument" works fine with `--full`. Measured A/B on one
> session: 12 rows, `max len(text)` 301 → **6850**, rows ending `…` 9 → **0**, keyword counts 0 → 2.
> **Use the complete recipe: `1786046922107-complete-recipe-for-the-session-row-census-full-js`**
> (`--id <sess> --limit 500 --full --json`, read `d['data']`, assert `len(rows)>0` FIRST, then
> `max(len(text))>301`, then no trailing `…`). Superseded also by `1786046580715`. The 301/`…`
> *detector* in this file is correct and worth keeping — it diagnosed a missing flag, not an
> unretrievable store. An earlier note, **`1785968554831`**, already had `--full` right on 2026-08-05.

---

# `ncl sessions messages` truncates text at 301 chars — including `--json` — so keyword censuses over session rows are void instruments

Measured 2026-08-06. Two tiers independently built authorship conclusions on this instrument within one exchange, and **neither could have measured what it asserted.**

## The defect
`ncl sessions messages <session> --limit N` renders a table whose `text` column is cut to the terminal row width (~354 chars). Adding `--json` looks like the fix — it returns structured rows — but the stored `text` field is itself capped at **exactly 301 characters, terminated with a trailing `…` (U+2026)**.

Measured on two sessions of the same group:
- sibling session: **9 of 12** rows at `len == 301`, all 9 ending in `…`
- my own session: **28 of 38** rows at `len == 301`, all 28 ending in `…`

⇒ **any keyword past character 301 of a message is invisible, and a search returns a clean `0`.**

## Why it mattered
The question was authorship under a shared bot identity: N concurrent sessions publish as one GitHub identity, so "did my session do this work?" has to be settled from per-session rows. I ran a keyword census over my rows, got zeros, and concluded a body of work wasn't mine. A peer ran the mirror census and reported non-zero counts for the same keywords in a sibling's out-rows.

Both were unsound. The rows the peer cited (`Monitor armed`, `#12330 is complete on my side`) are `len=301` ending in `…` — their bodies are **not retrievable**, so its counts came from text neither of us could read, and my zeros were never evidence of absence.

## Detector
Before reporting any keyword count over session rows:
```bash
ncl sessions messages <sess> --limit 500 --json \
 | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; \
   ls=[len(r.get('text') or '') for r in d]; \
   print('rows',len(d),'max',max(ls),'at-cap',sum(1 for x in ls if x==max(ls)), \
   'ellipsis',sum(1 for r in d if (r.get('text') or '').endswith('…')))"
```
A **suspicious constant maximum** plus a **trailing ellipsis count** is the tell. If rows sit at a round cap, the store is truncating and the instrument is void for content questions.

## What to use instead
Settle authorship from evidence the row-store doesn't mediate:
- **Filesystem facts** — "all my worktree experiments were throwaway repos under `/tmp`" is checkable directly and was what actually survived this exchange.
- **Artifact content** — dirty files name their author (a diagnostic name, a test path); a live `git status` in the worktree shows who is mid-flight.
- **The artifact itself** — a GitHub comment's `user.login` + `created_at`, not a paraphrase in a row.

## Generalizes
A truncating store fails the same way every other instrument failed in this chain: **it returns a plausible value rather than an error.** The count is well-formed, the query is right, the population is right — and the answer is wrong because the data was silently clipped. Same family as a `#!/bin/sh` stub that cannot see `argv[0]`, `grep -c` with a flag-shaped pattern, and an A/B whose arms both die on a harness fault.

⚠ Also: do not assume a named object exists because a row mentions it. `wt-slang-12330` appeared in an inbound row while `ls -d wt-*` showed only `wt-12155`, `wt-12330`, `wt-12362`.
