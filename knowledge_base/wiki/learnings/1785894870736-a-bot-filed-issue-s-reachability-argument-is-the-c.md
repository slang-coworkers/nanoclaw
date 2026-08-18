---
title: "A bot-filed issue's reachability argument is the claim to verify first"
type: learning
topic: verification
source: learnings/1785894870736-a-bot-filed-issue-s-reachability-argument-is-the-c.md
---

# A bot-filed issue's reachability argument is the claim to verify first

On slangpy#1091 (filed by our own nv-slang-bot coworker), the two claimed code facts were exactly right and the *reachability* argument built on them was wrong — which inverted the severity.

**The pattern:** a latent-defect issue has two separable parts: (1) the divergence exists in code, (2) someone can reach it. Part 1 is cheap to verify and tends to be correct, because the filer read those lines. Part 2 is the load-bearing one for severity and tends to be *reasoned*, not read. Verify part 2 first.

**The concrete miss:** #1091 argued the gap was "externally reachable through the C ABI" because `get_signature` is a member of the exported `TensorBridgeAPI` struct. But an exported *function-pointer field* only exposes whatever was assigned to it. `static const TensorBridgeAPI g_api = {..., tensor_bridge_get_signature, ...}` (`src/slangpy_torch/torch_bridge_impl.cpp:306-316`) wires in the **native** implementation; the divergent fallback (`python_get_signature`) lives on a `slangpy_ext`-internal class whose header is never installed. So no external caller can reach both rules — the "victim" scenario had no victim.

**Probe that settles this class of claim in one step:** don't stop at "the symbol is in the exported struct." Read the *struct initializer* to see which implementation each field points at, and check whether the divergent implementation's header has an `install()` rule. Two greps.

**Second-order lesson:** the bot's repro string was `[D3,S6,V432,G0]` — a format from an unmerged PR (#1054), not from `main`. A repro that cites a format the target branch doesn't emit is a tell that the arithmetic was composed rather than executed. Check the repro's literals against the branch under triage before trusting any number derived from them (its "31 bytes" figure was 28 on main, too).

**Cheapest severity cap, worth finding early:** the native bound is `BASE_SIZE(64) + ndim`, and torch caps rank at 64 (`dim_bitset_size = 64`, ATen `WrapDimUtilsMulti.h`) — so `required_size <= 128`, exactly the buffer both in-tree callers pass. An external constant can make a whole bound unreachable; look for it before mapping fixes.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785894870736-a-bot-filed-issue-s-reachability-argument-is-the-c.md`_
