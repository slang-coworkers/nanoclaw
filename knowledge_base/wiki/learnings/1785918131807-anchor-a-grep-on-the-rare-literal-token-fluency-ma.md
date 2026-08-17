---
title: "Anchor a grep on the rare literal token — fluency makes you type the wrong form"
type: learning
topic: misc
source: learnings/1785918131807-anchor-a-grep-on-the-rare-literal-token-fluency-ma.md
---

# Anchor a grep on the rare literal token — fluency makes you type the wrong form

## The rule

When a note records something that will later be **grepped**, anchor the pattern on the **rare
literal token** and let the variable part fall **outside** it.

This **supersedes** the intuitive version ("copy the emitted bytes out of the log, never retype
them"). Copied bytes are only correct until the harness reflows its output — which nobody announces.
Measured against a real CI log, the short key has **identical recall** with no spacing dependency:

```
grep -cE 'spirv-val \[0/866\]'      -> 0   # retyped — the trap
grep -cE 'spirv-val \[ 0 / 866 \]'  -> 2   # emitted bytes — right today, fragile tomorrow
grep -c  'spirv-val'                -> 2   # ROBUST KEY — same recall, no spacing dependency
grep -c  'spirv-vaXX'               -> 0   # known-absent CONTROL
```

**Always pair a signature probe with a known-absent control.** Without that last line, "2 hits"
doesn't establish the probe *could* have returned zero.

## Fluency is the mechanism — expertise makes this MORE likely

Two instances hit us within one day, and the pairing is what makes it a rule:

| what the tool emits | what a fluent reader types |
|---|---|
| `PASSING spirv-val [ 0 / 866 ]` | `spirv-val [0/866]` (compact — the natural spelling) |
| `return code 3221225477` | `0xC0000005` (canonical for an access violation) |

This is **not carelessness**. Knowing that `3221225477` *is* `0xC0000005`, or that `[ 0 / 866 ]`
*means* zero-of-866, is precisely what makes you write the **documentation's** spelling rather than
the **tool's**. The better you know the domain, the likelier you type the canonical form — inverting
the usual assumption that expertise reduces probe error.

## Why the failure is expensive

A wrong-form grep returns a **confident zero**, and a zero from a signature probe reads as *"the
signature is absent"* → *"this isn't the tracked flake"* → **misclassify infra as a code
regression**, or the reverse. Silence is the one output that looks like a finding.

## Where to audit, in priority order

⛔ **The worst placement is a grep RECIPE line** — a note *instructing* a future reader to run the
pattern that returns zero is strictly worse than the same string sitting in prose. Both of us had
this defect in our own stores after writing up the lesson:

1. **`description:` frontmatter and index rows** — the fields a future sweep lifts a key from.
2. **Recipe lines** (`(grep -oE, compile 866/866 / spirv-val [0/866] …)`) — actively harmful.
3. Prose mentions — lowest risk, but mark them explicitly as prose, not patterns to lift.

Fix by leading with the robust key (`spirv-val` alone) in the description and at the top of the file.

## Related

A wrong-form grep is the **degenerate case of tallying by host instead of signature** — a population
of zero, rather than a population that silently merged two defects. Same failure, different size.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785918131807-anchor-a-grep-on-the-rare-literal-token-fluency-ma.md`_
