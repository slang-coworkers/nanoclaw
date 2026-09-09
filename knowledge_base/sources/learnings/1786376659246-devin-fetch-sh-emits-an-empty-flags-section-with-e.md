---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786375931183-s1yud1
written_at: 2026-08-10T15:44:19.246Z
---

# devin-fetch.sh emits an EMPTY Flags section with exit 0 — newline-escape mismatch, not a clean verdict

## Symptom

`nanoclaw-pr-review-runner/scripts/devin-fetch.sh` exits **0** and writes a `devin-flags.md`
whose `## Flags` section is **completely empty** — the textbook false clean. Observed on
shader-slang/slang#12448 @`e87cb320422a`, where Devin had actually reported **0 Bugs / 1 Flag**
plus 7 named findings (incl. an `Investigate`-severity one at `ci-slang-coverage-test.yml:270-277`).
The body-integrity guards did NOT fire: no `Generating…` token, and the file was 5069 B (well over
`DEVIN_MIN_BYTES=200`) because the whole PR description had been swallowed into `## AI Analysis`.

## Root cause

`agent-browser eval 'document.body.innerText'` returns the dump **JSON-quoted as ONE line** —
literal backslash-`n` escapes, not real newlines. Measured on the artifact:
`real newlines in dump: 1` vs `literal backslash-n: 1291`.

The extractor (`devin-fetch.sh:188`) splits on real newlines:
```python
parts = re.split(r'\n\s*\d+\s*Flags?\s*\n', text, maxsplit=1)
```
That never matches ⇒ `flags = ''` and `analysis = <entire page>`. Then `analysis[:5000]`
truncates — and the verdict panel sits at **char 34443**, so `0 Bugs / 1 Flag` and every
finding are cut off. Both failure legs point the same way: findings silently vanish while
exit stays 0.

## How to catch it

- **Demand a POSITIVE token, never trust an empty section.** `## Flags` empty + exit 0 is
  indistinguishable from "Devin found nothing" *unless* you grep the raw dump for the verdict:
  `grep -oiE "[0-9]+ (Bug|Flag)s?|No flags" devin-page.txt`. Absent ⇒ inconclusive, not clean.
- **Always read `devin-page.txt`, not just `devin-flags.md`.** The raw scrape had the full
  verdict; only the derived file was lossy.
- Liveness cross-check: an auth-walled page also prints `Connect GitHub` / `Sign in` in the
  nav rail even when the review IS readable — those tokens alone do NOT prove an auth wall.
  On #12448 both appeared *and* the findings were present.

## Fix (recover the findings without a re-run)

```python
t = open('devin-page.txt', encoding='utf-8').read().replace('\\n', '\n')  # unescape FIRST
i = t.find('0 Bugs')            # or regex r'\d+ Bugs?'
seg = t[i:]; flags = seg[:seg.find('\nChecks\n')]
```
Findings render as **title / severity / file:line triplets**, terminated by the `Checks` panel.

The durable script fix is to `.replace('\\n', '\n')` before the split and to raise/remove the
5000-char analysis cap (or slice the analysis *backwards* from the verdict index). Until that
lands, treat every `devin-flags.md` with an empty `## Flags` as **unextracted, not clean**, and
re-derive from `devin-page.txt`.
