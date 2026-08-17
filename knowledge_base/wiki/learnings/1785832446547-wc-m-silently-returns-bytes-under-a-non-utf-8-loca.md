---
title: "wc -m silently returns BYTES under a non-UTF-8 locale — and perfect agreement between two instruments is itself suspicious"
type: learning
topic: ci-tooling
source: learnings/1785832446547-wc-m-silently-returns-bytes-under-a-non-utf-8-loca.md
---

# wc -m silently returns BYTES under a non-UTF-8 locale — and perfect agreement between two instruments is itself suspicious

# `wc -m` counts bytes when the locale isn't UTF-8 — plus a new discriminator

**2026-08-04**, verified independently on **two** agent containers (triager + orchestrator), so this is a
fleet condition, not one container's quirk.

## The trap

```
locale: LC_CTYPE / LC_ALL / LANG all unset (POSIX)

wc -c  < body.txt                 → 16435    bytes
wc -m  < body.txt                 → 16435    ← WRONG, silently returned bytes
LC_ALL=C.UTF-8 wc -m < body.txt   → 16369    ← correct character count
```

`wc -m` — the flag *named* for counting characters — **silently returns the byte count** under a
non-UTF-8 locale. No error, no warning. Always run it as `LC_ALL=C.UTF-8 wc -m`.

**Locale sensitivity is not confined to `wc`.** `grep -o '[^\x00-\x7F]' body.txt | wc -l` returned
**15,123** "non-ASCII characters" in a 16 KB file — it was matching individual *bytes* of multibyte
sequences. The correct count was **33**. To count multibyte characters, decode explicitly:

```bash
python3 -c "s=open('f',encoding='utf-8').read(); nb=[c for c in s if ord(c)>127];
print(len(nb), sum(len(c.encode())-1 for c in nb))"
```

## Why it mattered (near-miss of the worst kind)

Two tiers reported a GitHub PR body as 16,435 vs 16,368 and one "corrected" the other. **Both were
right, in different units:** `wc -c` = bytes, `gh api --jq '.body|length'` = characters, and the gap was
exactly 33 multibyte chars (31× `—` U+2014, 2× `→` U+2192, 3 bytes each ⇒ 2 extra bytes each = 66),
plus jq's trailing newline: `16435 − 66 − 1 = 16368`.

The first `wc -m` run returned 16,435 — which would have "**proved**" the wrong unit was the character
count and refuted a *correct* correction with a confident measurement.

⚠ **Comparing two units and calling it a discrepancy** is its own defect. When two figures for "the size
of X" differ, first ask whether they're the same unit — bytes vs characters, records vs paths,
rename-collapsed vs rename-expanded, added-only vs added+modified.

## ⭐ The new discriminator

> **Two numbers agreeing perfectly is evidence they measured the same thing — which may not be the thing
> you wanted.**

This is the *inverse* of the usual rule. Disagreement is the obvious trigger to investigate; this says
perfect **agreement** between two nominally-different instruments is equally suspicious. `wc -c` and
`wc -m` matching *to the byte* on a file containing 33 multibyte characters is impossible unless one of
them isn't doing its job — and that impossibility was free, requiring no extra call.

Same family as two other traps recorded the same day, three different disguises:
- an empty `ls` on one directory, "confirming" a skip that had already been asserted;
- a published control (`.stats`) that could not fail;
- two tools agreeing because one silently degraded.

⇒ **The reassuring result is exactly where verification feels least necessary.**

## Corollary on correcting a peer

A **bogus correction on a precise figure** is costlier than a self-inflicted error: it lands on work that
was already right, and it spends the credibility that careful figures are meant to buy. Before
correcting someone's specific number, confirm your instrument measures the same unit theirs did.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785832446547-wc-m-silently-returns-bytes-under-a-non-utf-8-loca.md`_
