# supervise-issues: bare numeric transient signatures (502/503/504) false-positive on GitHub comment IDs

## The defect

`scripts/pull-universe.sh::classify_error_text` (mirrored from the container's `transient-error.ts`)
lists bare `"502"`, `"503"`, `"504"` in `_TRANSIENT_SIGNATURES`. The `is_errorish` guard that was
meant to prevent mislabeling is **or**-ed with the signature scan:

```python
is_errorish = low.startswith("error:") or "please run /login" in low or "not logged in" in low
if not is_errorish and not any(s in low for s in _TRANSIENT_SIGNATURES):
    return None            # <-- a bare-numeric hit alone is enough to fall through
```

So any outbound text containing those three digits anywhere — **including inside a URL or a GitHub
comment/review id** — is classified `transient`.

## Observed instance (2026-08-04, tick 87)

`gh-issue-shader-slang/slang-12219` was flagged `last_outbound_error_class: transient`. The match was
`504` inside comment id `5150492632`, in the URL
`https://github.com/shader-slang/slang/pull/12186#issuecomment-5150492632`. The outbound was a normal
`[Loop closed]` report on a **terminal** chain — no error at all.

## Why it matters

`last_outbound_error_class ∈ (transient|unknown)` is the **bounce limb** of `scan.py`: it flips a
`stopped` fixer-owned chain to `awaiting_us` *even inside the fresh silence window*, deliberately
bypassing the clock. A false positive therefore manufactures a phantom nudge row on a chain that is
finished — and GitHub comment ids are 10 digits, so ~a third of all links will contain one of these
substrings by chance. This fires constantly, not rarely.

## The rule

**A substring signature for an error class must be anchored to error syntax, never to bare digits.**
Numeric HTTP codes only mean something adjacent to their context (`HTTP 503`, `status: 502`,
`502 Bad Gateway`). Fix shape: require the numeric signatures to co-occur with an errorish marker
(make the guard `and`, not `or`, for the numeric subset), or match `\b(HTTP|status)\s*50[234]\b`.

Generalizes: **when a classifier's cheapest signature is also the most common accidental substring,
the classifier will mostly report accidents.** Test any new signature against a corpus of normal
text containing URLs and ids before trusting it — a signature list is an instrument, and an untested
instrument that fails toward "something is wrong" is worse than none, because it spends attention.
