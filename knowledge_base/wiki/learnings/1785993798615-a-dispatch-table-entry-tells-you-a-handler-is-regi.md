---
title: "A dispatch-table entry tells you a handler is registered, not what it does — and a correction is the least-audited place for a new false claim"
type: learning
topic: verification
source: learnings/1785993798615-a-dispatch-table-entry-tells-you-a-handler-is-regi.md
---

# A dispatch-table entry tells you a handler is registered, not what it does — and a correction is the least-audited place for a new false claim

## The near-miss

Reviewing slang PR #12378, a peer proposed sharpening the test-count sentence: of 28 harness cells, only
**27** actually *verify* anything, because `TEST:COMPILE` is a setup step that "verifies nothing." Their
evidence was the dispatch-table entry at `tools/slang-test/slang-test-main.cpp:4608`:

```cpp
{"COMPILE", &runCompile, 0},
```

**The citation was true and the conclusion was false.** Reading the handler instead of the registration:

```cpp
// runCompile, slang-test-main.cpp:2907-2952
if (exeRes.resultCode != 0)
{
    reporter->message(TestMessageType::TestFailure, output);
    return TestResult::Fail;
}
return TestResult::Pass;
```

Confirmed empirically: a probe test with deliberately invalid source behind a `//TEST:COMPILE:`
directive **failed** ("1 failing tests"). So `COMPILE` asserts `rc == 0` where `SIMPLE` asserts output
equality — **different assertions, both assertions.** There is no 27-vs-28 split.

## Two rules

⭐ **A dispatch-table entry, a registration, a config key, or a symbol in an index tells you something
*exists*. It does not tell you what it *does*.** Presence in the table was the evidence; the handler
body was the claim. This is a **true reading of an adjacent fact substituted for the fact in question** —
and it feels exactly like rigour, which is why it doesn't self-correct. The peer hit this same shape
three times in one review (inferred a test-outcome polarity from reading two code sites instead of
running them; cited `-llvm` cells as a gate without tracing `RenderApiType::LLVM →
SLANG_SHADER_HOST_CALLABLE`; and this). The failure mode is **plausibility, not carelessness**.

⭐⭐ **A correction is the least-audited place a new false claim can land.** Had the sharpening shipped, a
brand-new false statement would have entered *the very sentence being corrected for accuracy* — and
nobody re-checks a correction, because the act of correcting reads as already-verified. **Audit the
replacement text at least as hard as the text it replaces.** (Companion: an over-retraction costs as
much as an over-claim and is harder to catch, since retracting reads as rigour.)

## Cheap discriminator

When someone cites a *location* to support a claim about *behaviour*, ask which one the citation
establishes. Then read the body — or better, run it. One probe test settled this in under a minute,
against two rounds of source-reading that had gone the wrong way.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785993798615-a-dispatch-table-entry-tells-you-a-handler-is-regi.md`_
