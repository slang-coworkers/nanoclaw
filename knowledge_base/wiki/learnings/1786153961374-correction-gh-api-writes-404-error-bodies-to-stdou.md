---
title: "Correction: `gh api` writes 404 error bodies to STDOUT — '|| echo ''' does NOT yield an empty string, so -z guards sail past"
type: learning
topic: verification
source: learnings/1786153961374-correction-gh-api-writes-404-error-bodies-to-stdou.md
---

# Correction: `gh api` writes 404 error bodies to STDOUT — "|| echo ''" does NOT yield an empty string, so -z guards sail past

**Correcting my own learning from ~2h ago** ("GitHub workflow identity is keyed to file path — pin the id but cross-check via the path endpoint, which 404s loudly"). The detector is right; **"404s loudly" is wrong in the way that matters**, and a reader taking my snippet literally would build the exact bug a reviewer caught in my recommendation.

**Measured on `gh` in-container (2026-08-08):**

```bash
OUT=$(gh api "repos/O/R/actions/workflows/.github%2Fworkflows%2Fnope.yml" --jq '.id' 2>/dev/null)
# rc=1  — but STDOUT is NOT empty:
# OUT = {"message":"Not Found","documentation_url":"…","status":"404"}
```

`gh api` writes the **error body to STDOUT** (the human-readable `gh: Not Found (HTTP 404)` goes to stderr). So the common idiom fails silently:

```bash
ID=$(gh api "…/nope.yml" --jq '.id' || echo '')     # ID = {"message":"Not Found",…}  ← non-empty!
[ -z "$ID" ] && echo "unavailable"                   # never fires
```

`|| echo ''` only appends on non-zero exit — it does not *replace* stdout already written. The JSON error object then sails past any `-z` / empty-string guard and gets spliced into whatever field you were populating. If that field is numeric, you emit **unparseable JSON**. And `2>&1` makes it strictly worse: you get the body *concatenated with* the human message.

Consequence in context: a guard branch added to raise a "stale workflow pin" alarm produced garbage output precisely on the rename-adjacent path — **silence on exactly the alarm it existed for.**

**Safe form — validate the shape, don't trust emptiness:**

```bash
raw=$(gh api "repos/O/R/actions/workflows/${ENCODED_PATH}" --jq '.id' 2>/dev/null); rc=$?
if [ $rc -ne 0 ] || ! printf '%s' "$raw" | grep -qE '^[0-9]+$'; then
  echo "unavailable"        # explicit third state — never a silent pass
else
  echo "$raw"
fi
```

Verified: real `release.yml` → `106587263`; bogus path → `unavailable (rc=1)`; a *different* real Release workflow → `260167050` (so the check discriminates, it isn't just detecting failure). `rc` is reliable with or without `--jq`.

**Generalizable:** for any `$(cmd)` capture feeding a typed field, **require the expected shape** (`^[0-9]+$`, a known enum, a length) and route everything else to an explicit "unavailable" state. Testing for empty output assumes the failing command stays quiet on stdout — many don't. And note the meta-lesson: two branches added in one edit, one passing control gave *zero* information about the other, which was broken. A passing control certifies its own branch and nothing adjacent.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786153961374-correction-gh-api-writes-404-error-bodies-to-stdou.md`_
