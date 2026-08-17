---
title: "Narrowing a claim is not testing its premise — and check your own store before re-deriving"
type: learning
topic: verification
source: learnings/1785778559075-narrowing-a-claim-is-not-testing-its-premise-and-c.md
---

# Narrowing a claim is not testing its premise — and check your own store before re-deriving

# Narrowing a claim is not testing its premise

**Observed 2026-08-03, shader-slang/slang-rhi #800/#801 (Main).** I asserted, then
narrowed, then had to fully invert a claim about which Metal code path CI runs.
Three failures stacked, and the third is the reusable one.

## What happened

I recorded: *"the residency **fallback** path is unexercised / merged unverified;
`SLANG_RHI_METAL_NO_RESIDENCY_SET` is the only thing that closes it."* And for the
sibling PR I relayed a coworker's grounds: *"the address map is dead code when
`m_hasResidencySet` is true, which holds on Apple Silicon = exactly these legs;
the test shader has no pointer field so `find()` is never called."*

**Both were polarity-inverted.** At source, `m_hasResidencySet = true` is assigned
only inside `else if (m_device->supportsFamily(MTL::GPUFamilyApple6))`; the hosted
`Apple Paravirtual device` lacks Apple6, so control reaches the terminal `else`
that logs `GPUFamilyApple6 not supported; using per-encoder useResource fallback`.
CI runs the **fallback by default** — it is the *covered* path, and the
residency-**set** path is the uncovered one, needing hardware CI lacks. The env
var forces the path CI already takes, so it was never the missing artifact.

## The three lessons, weakest to strongest

**1. Absence of a log line is not evidence until you prove the line would print.**
`checkDeviceTypeAvailable` assigns `result.debugCallbackOutput` **only** inside the
`RETURN_NOT_AVAILABLE` failure macro, so on a green run the string is empty and the
reporter's *unconditional* `printf` emits nothing. An unconditional print does not
imply an unconditional value. Measured: the diagnostic appeared **0×** in the green
job I kept re-reading and **3×** in a *failing* sibling job. The affirmative
evidence lived in the log we never thought to open.

**2. ⭐ Narrowing a claim is not testing its premise.** I retracted "the fallback is
unexercised" and rewrote it as "the fallback is unverified" — weaker, *same
direction*, same untested premise: **which path does CI actually take?** A
retraction that narrows without testing the premise **inherits the error and
launders it as diligence.** Before recording either version, ask: what single
observation would settle this, and is it cheap? Here it was one unauthenticated
`curl` of a public job log.

**3. ⭐⭐ Check your own store before re-deriving — a recall failure, not an evidence
failure.** The correct answer was *already written down in my own notes*, in the
standing lesson on green-job/zero-coverage:

> "Also verify the runner's **feature tier** … the same log showed
> `GPUFamilyApple6 not supported; using per-encoder useResource fallback`, meaning
> CI exercised the *fallback* path — which inverted an earlier claim."

I had recorded the exact line, the exact conclusion, and the fact that it had
*already* inverted a previous claim — then contradicted it for an entire chain.
Recall loads at session start; it does not fire at the moment you form a new
claim. So when a claim turns on a **stable environment property** (runner GPU
family, image contents, required checks, driver tier), grep your own notes for
that property *before* reasoning about it. The rule that would have saved this was
one line away in the same index.

## Corollary for relaying

Two of us independently agreed on the wrong premise (a bot reviewer concurred
too). **Independent agreement on a premise nobody tested is not corroboration.**
When I relay a coworker's grounds as fact, I inherit them — I had the
disconfirming rows (7 `bind-pointers-*.metal PASSED`) in a log I pulled myself and
pasted into my own report, and still failed to join them to "`find()` is never
called."

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785778559075-narrowing-a-claim-is-not-testing-its-premise-and-c.md`_
