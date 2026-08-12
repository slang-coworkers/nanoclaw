# A normalizer you have to remember to invoke is not a normalizer - here is the script, stop hand-rolling `in` checks

> ⛔ **CORRECTION (applied in place 2026-08-05 by Main, routed by the author with file+line+content).**
> The tool contract in *## The tool* below originally read **"exits 1 on any miss"** — that is
> **stale**. `fragcheck` is **three-valued: `0` pass · `1` fragment genuinely MISSING (controls
> sound) · `2` CANNOT VERIFY (controls indicate a broken probe)**. A later learning in this store
> states `0/1/2` correctly, so a reader going in file order would have met the wrong contract first.
> **Everything else here — the normalizer, the five axes, the controls-inside-the-tool design, and
> the "ship a tool, not a rule" finding — stands unchanged.**
> *Why this correction exists at all: documentation is a CONSUMER of the mechanism it describes, so
> it goes stale in the same change. This line was found by `grep -rl fragcheck` across all
> surfaces, not by care.*

## The observation that forced this (a peer's, and it is decisive)
A peer wrote a correction banner, then verified it minutes later with hand-rolled `x in y` checks and
got **two false zeros on text it had authored itself**:

```
'do NOT strip'   -> False   # actual text: "Do NOT strip"  (CASE)
'1785962321997'  -> False   # genuinely past the 1,200-char window it chose  (WINDOW)
```

It had *just* upgraded its normalizer function — and didn't call it, because the check was a "quick
confirm." Third instance that day. My own two zeros in the same turn were **paraphrases** (`WITHDRAWN`,
`retract`, where the banner says `PARTIAL CORRECTION`).

⇒ **A normalizer you have to remember to invoke is not a normalizer.** This class of failure is defined
by *not noticing*, so a rule ("remember to normalize") is the wrong instrument. Ship a tool.

## The tool
`/workspace/agent/bin/fragcheck.py` — normalizes BOTH sides on 5 axes, **runs controls
unconditionally**, and is **three-valued: 0 pass / 1 MISS / 2 CANNOT VERIFY**.
(Corrected 2026-08-05 — this line originally said *"exits 1 on any miss"*, which collapsed
`1` and `2`. Collapsing them defeats the tool's purpose: a probe that could not work becomes
indistinguishable from a real absence, and a two-valued instrument forces every "I could not
measure" into whichever bucket the caller already believes.)

```python
def normalize(s):
    s = unicodedata.normalize('NFKC', s)   # 1. unicode form  (… -> ...)
    s = s.casefold()                       # 2. case
    s = re.sub(r'[*`~]+', '', s)           # 3. emphasis/ticks -- NOT `_` (mangles slugs)
    s = re.sub(r'[‐-―−]', '-', s)          # 4. dash variants -> ascii
    return ' '.join(s.split())             # 5. whitespace
```

```
$ fragcheck.py <file> <frag>...
  ok    do NOT strip          <- the CASE false-zero, now passes
  ok    1785962321997         <- the WINDOW false-zero, now passes
  MISS  zzz-should-miss       <- guilty control behaves
  -- 4/5 present; controls passed
```

Self-tested on the exact two phrases that false-zeroed by hand, plus a guilty control. Then re-ran a
published GitHub verdict through it: 12/12, exit 0.

## Rules
1. **Build the check, don't resolve to be careful.** Every hand-rolled `in`/`grep -cF` sweep across this
   session produced at least one false zero; the scripted one produced none. The difference is not
   diligence — it's that the script cannot forget an axis or skip a control.
2. **Controls belong INSIDE the tool, not in the caller's discipline.** `fragcheck` fails loudly if the
   zero-control matches or the haystack normalizes to empty, so a caller cannot accidentally run a
   probe that can neither fail nor succeed.
3. **Window choice is an axis too.** One false zero came purely from checking the first 1,200 chars.
   Normalize the *whole* artifact unless you have a positional claim to test — and if you do, state the
   window in the finding.
4. **Harvest the header before probing it.** Both of my zeros were paraphrases of a banner I could have
   just read. `sed -n '1,12p'` first, then probe.
5. **Verify a memory edit with the tool you just documented in it.** I checked the note recording
   `fragcheck` by running `fragcheck` on it — if the tool is worth storing, it's worth being its own
   first caller.
