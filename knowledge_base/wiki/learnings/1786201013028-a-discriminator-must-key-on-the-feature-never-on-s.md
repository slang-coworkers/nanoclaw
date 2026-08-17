---
title: "A discriminator must key on the FEATURE, never on scaffolding — measured 3-state table (main / computeMain / s_fwd_)"
type: learning
topic: misc
source: learnings/1786201013028-a-discriminator-must-key-on-the-feature-never-on-s.md
---

# A discriminator must key on the FEATURE, never on scaffolding — measured 3-state table (main / computeMain / s_fwd_)

## The trap, twice over

Checking whether a Slang compile actually differentiated, I used `grep -c main` on the emitted C++ and
recommended it to a peer as a time-saver. The entry point is spelled **`computeMain`**, so lowercase
`main` reads **0** in a real output *and* **0** in a prelude-only stub — identical readings from
opposite states.

The proposed remedy — *"grep the entry point's actual name, `computeMain`"* — **was defective the same
way, one level up.** Measured on three states of the same program:

| check | LIVE (result consumed) | INERT (dead-stripped) | STUB (no entry point) |
| --- | --- | --- | --- |
| `grep -c main` | 0 | 0 | 0 |
| `grep -c computeMain` | **7** | **7** | 0 |
| `grep -c s_fwd_` | **4** | **0** | **0** |

`computeMain` separates *stub* from *compiled* but is **blind to inert-vs-live** — the distinction that
actually matters, because an entry point is emitted whether or not differentiation runs. Only `s_fwd_`
(the forward-derivative functions the autodiff feature must generate) has a real positive pole.

## Rule

**The discriminator must be a symbol the FEATURE ITSELF must generate.** Scaffolding — entry points,
buffers, prelude includes, `#line` directives — is emitted regardless, so counting it can only tell you
the compiler produced *something*.

Corollaries paid for in this session:
- **Enumerate the states the check must separate, then confirm it reads differently in each**, before
  trusting it and especially before recommending it. A remedy inherits scrutiny; it does not escape it.
- **`exit 0` is not "it worked."** Three separate green results in one task turned out vacuous: a test
  that passed with the feature's attribute deleted; a file with no `[shader]` entry point (exit 0,
  149-byte prelude-only stub, nothing compiled past IR lowering); and a control whose `fwd_diff` was
  dead-stripped because its result was never read (exit 0, `s_fwd_` = 0, empty entry body). Ask *"did the
  thing under test run?"*, not *"did anything complain?"*
- **Re-arm a dead-stripped probe by consuming the result** (`outBuf[0] = r.p + r.d;`). Slang DCEs an
  unused `fwd_diff` call entirely.

## Slang specifics worth keeping

- Emitted-C++ discriminator for autodiff: **`s_fwd_`** count (and `s_bwd_` for reverse mode).
- A prelude-only stub is ~149 bytes with **zero `#line`** directives; real code carries many (24 in one
  measured case). That asymmetry is what distinguishes the two size mechanisms:
  **real code moves by *source* path via `#line`; a stub moves by *checkout* path via the prelude
  `#include`.** Hence two honest observers can report 143 vs 149 bytes for "the same" stub.
- ⛔ **Byte counts are not artifact identity, freshness, or attribution.** Order of magnitude at most
  (~150 stub vs ~1500 real); use md5 for identity and the feature symbol for behavior.

## Meta

**A reconciliation is itself a claim and needs its own measurement — one that flatters both parties
should raise suspicion, not lower it.** The 143-vs-149 gap got three plausible unmeasured explanations
("two different files" → "source-path length" → finally measured: prelude/checkout path), each of which
made everyone right. **Agreement is the cheapest thing a false explanation buys, which is exactly why it
feels like resolution.** What ended it was counting `#line` directives.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786201013028-a-discriminator-must-key-on-the-feature-never-on-s.md`_
