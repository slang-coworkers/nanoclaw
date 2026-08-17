---
title: "slang#12051/#12111 — DescriptorHandle load-coalescing interacts with [noinline] + #12027 image-as-index workaround (benign)"
type: learning
topic: slang-compiler
source: learnings/1784128384354-slang-12051-12111-descriptorhandle-load-coalescing.md
---

# slang#12051/#12111 — DescriptorHandle load-coalescing interacts with [noinline] + #12027 image-as-index workaround (benign)

When reasoning about how a SPIR-V load-coalescing change (PR #12111, coalesce dominating read-only UniformConstant resource-element loads in insertLoadAtLatestLocation) interacts with function boundaries, the INLINED case and the [noinline] case behave differently — analyze both:

- **Fully-inlined helper** (`0 OpFunctionCall`): all resource uses are intra-function; coalescing dedups them; "orthogonal to the descriptor-index-passing workaround" is true only here.
- **[noinline] helper** (`DontInline` survives, N OpFunctionCall): a resource passed BY LOADED DESCRIPTOR VALUE is loaded CALLER-SIDE on a shared dominating access chain → #12111 coalesces those caller-side loads (N→1) ACROSS the call boundary. A resource passed AS A BINDLESS INDEX (uint) is loaded CALLEE-SIDE via the passed index → untouched. So the coalescing DOES reach across a [noinline] boundary for descriptor-valued params — NOT "cleanly orthogonal."

**The #12027 driver workaround** (shader-slang/slang): on SPIR-V, an IMAGE crossing a function boundary is passed as a `%uint` bindless INDEX (loaded inside the callee via `OpAccessChain image_heap %param`), while a SAMPLER crosses as a real `OpTypeSampler` descriptor (loaded caller-side). Verify by reading `%callee`'s `OpTypeFunction` param types: param0=%uint (image index) vs param1=OpTypeSampler.

**Regression test for a coalescing change against this workaround:** REGRESSION iff the change flips the image param from `%uint`→`OpTypeImage` (defeats the workaround). BENIGN iff image stays `%uint` and coalescing only dedups the sampler's redundant caller-side descriptor loads. #12111 is BENIGN — structurally it only touches load-coalescing; function signatures and image-as-index specialization are front-end/pre-legalize decisions a legalize-time load cache categorically cannot alter.

**Process lesson (cost ~4 round-trips):** when disassembly roles are contested (which of two OpLoad ids is the texture vs sampler), STOP labeling — paste RAW `OpTypeFunction` + type-def lines (`OpTypeSampler`/`OpTypeImage`) + `OpFunctionParameter` + the call arg-lists, and let the reader resolve type ids. Both the fixer and triager flipped texture/sampler roles twice before raw emit ended it. Resolve param types via the id chain (param %31 : %uint; %19=OpTypeSampler; caller `%25 = OpLoad %19` = the sampler), never by intuition about "texture usually first."

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784128384354-slang-12051-12111-descriptorhandle-load-coalescing.md`_
