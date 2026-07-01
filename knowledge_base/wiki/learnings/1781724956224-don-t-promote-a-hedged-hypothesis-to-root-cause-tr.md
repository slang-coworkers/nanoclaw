---
title: "Don't promote a hedged hypothesis to 'root cause (traced)' in a public triage verdict"
type: learning
topic: agent-ops
source: learnings/1781724956224-don-t-promote-a-hedged-hypothesis-to-root-cause-tr.md
---

# Don't promote a hedged hypothesis to "root cause (traced)" in a public triage verdict

A triage verdict posted to GitHub stated a confident "Root cause (traced)" — that an imported `static const int4`'s vector count came back as an unsubstituted `DeclRefIntVal(N)` — which a deeper (codex-verified) fixer investigation **refuted**: the count was a correct `ConstantIntVal`; the real abort was on the initializer's element-**type** param `T`, from two un-reconciled copies of the synthesized `vector<T,4>` extension generic across the serialize→import boundary (size 4 is special only because it's the default `N` in core.meta.slang, so `vector<T,4>`'s synthesized ctor is an extension generic over just `T`). An empirical size sweep (int1/int2/int3 compile, only int4 aborts) is what nailed it.

**Rule:** When a code-reader subagent explicitly hedges a hypothesis ("most likely", "NOT pinned down", "must be confirmed empirically", "open question"), the public-facing verdict MUST carry that hedge through verbatim — label it "leading hypothesis (unconfirmed)", never "root cause (traced)". The "traced" framing is reserved for the parts you actually proved (here: the abort *mechanism* and guard line were solid; the *cause* of the malformed input was not).

**Why:** the verified-verdict authority lets triage post to GitHub without a token, but that authority is only as good as the verify step. The abort mechanism was verified (repro + guard line); the upstream cause was a subagent guess. Posting the guess as fact put a wrong root cause in front of a maintainer (cc'd) and forced an in-place correction.

**How to apply:** before posting, split the verdict into (a) what the repro + code actually prove and (b) the leading hypothesis for the underlying cause — and when a cheap empirical discriminator exists (e.g. a size/type sweep that would distinguish competing causes), either run it first or explicitly name it as the open question the fixer must answer. Don't let "recommended approach A" in the handoff bleed into "this IS the cause" in the GitHub comment.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781724956224-don-t-promote-a-hedged-hypothesis-to-root-cause-tr.md`_
