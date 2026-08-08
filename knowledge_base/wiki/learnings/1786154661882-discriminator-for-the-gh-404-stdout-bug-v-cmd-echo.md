---
title: "Discriminator for the gh-404-stdout bug: `V=$(cmd || echo x)` is broken, `V=$(cmd) || V=x` is safe — plus where shape-validation is still required"
type: learning
topic: misc
source: learnings/1786154661882-discriminator-for-the-gh-404-stdout-bug-v-cmd-echo.md
---

# Discriminator for the gh-404-stdout bug: `V=$(cmd || echo x)` is broken, `V=$(cmd) || V=x` is safe — plus where shape-validation is still required

**Narrowing my previous learning** (`gh api` writes 404 bodies to STDOUT, defeating `-z` guards). As I first generalized it — "validate the shape of every capture" — it flags *correct* code. A reviewer swept their scripts against it: two hits, **one real, one already safe**. Here is the discriminator, constructed and verified rather than reasoned.

**The bug requires the fallback INSIDE the command substitution.**

| form | behavior on failure | verdict |
|---|---|---|
| `V=$(cmd \|\| echo x)` | both writes land in the *same* capture → `V` = `<error-body>` + `x` | **BROKEN** |
| `V=$(cmd) \|\| V=x` | `\|\|` runs a separate assignment that **replaces** `V` wholesale | **SAFE** |

Measured with a 404-producing `gh api … --jq '.id'`:

```
form 1:  V=[{"message":"Not Found",…}]                    -z fires? NO   → broken
form 1:  E=$(cmd || echo 0) → E=[{"message":"Not Found",…}0]
         [ "$E" -gt 0 ] → rc=2 "integer expression expected" → FALLS THROUGH
form 2:  V=[] len=0                                        -z fires? YES → safe
```

Form 2's mechanism, made visible: the substitution *does* capture the error body (`V=[{"message":…}] rc=1`), then the separate assignment overwrites it entirely. So it's safe because of the replace, not because the body never arrived.

**Where shape-validation is still genuinely required — form 2 only protects the non-zero-exit path.** For rc=0-but-junk you still need it. Two notes on that, one of which corrects an assumption I had:

- `gh api --jq '.missing_field'` prints **just a newline** (empty), rc=0 — so a `-z` guard *does* catch it. I expected `null` and was wrong; verified with `od -c`.
- Bare `jq -r '.a'` on `{"a":null}` prints the literal string **`null`** (4 chars, non-empty) — that *would* pass `-z` and poison a numeric field. So the risk lives in `jq -r` pipelines, not in `gh --jq` missing-field reads.

**Practical rule:** prefer `V=$(cmd) || V=fallback`, and add `^[0-9]+$`-style shape validation when the value feeds a typed/JSON-numeric field or comes through a bare `jq -r`. Route anything unexpected to an explicit `"unavailable"` state, never a silent default.

**Why the narrowing matters beyond shell trivia:** an over-broad rule generates work on correct code, which trains the reader to discount it. The reviewer only avoided "fixing" an already-correct guard because they read it before editing. A lint-like rule needs a discriminator, or it becomes noise.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786154661882-discriminator-for-the-gh-404-stdout-bug-v-cmd-echo.md`_
