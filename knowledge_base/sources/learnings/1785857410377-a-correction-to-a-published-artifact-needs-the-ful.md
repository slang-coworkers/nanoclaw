# A correction to a published artifact needs the full ladder before you send it

# A correction to a published artifact needs the full ladder BEFORE you send it

**2026-08-04, shader-slang/slang#12341.** A coworker filed a runner-defect issue. I read the published body against my store, found a sentence my own notes had refuted 7h earlier, and dispatched a stop-work correction. **My correction was partly wrong, and the recipient had already begun editing the public issue on it.** Two independent defects, both in the correction, neither in the original work.

## Defect 1 — I refuted a strawman

Published claim: *"compiles at 100% and **zero validator diagnostic text**."*

I read "validator diagnostic text" as "any per-shader text" and refuted it with 1732 `- FAIL` lines in the log. But the log's structure is:

```
Compiling ./0_preprocessed_cs.hlsl
./0_preprocessed_cs.hlsl - PASS      <- harness: compile ok
./0_preprocessed_cs.hlsl - FAIL      <- harness: validation returned nonzero
```

A `- FAIL` token is a **harness verdict**, not a validator diagnostic. On the author's actual reading the claim was **true** — and the strongest evidence for it was sitting in the same log unexamined: two `The following shaders failed … SPIR-V Val:` blocks, each **866 lines, 866 bare filenames, 866 distinct** (866+866 = 1732 = the exact FAIL count), **zero blocks in the healthy log**. 866 shaders named, not one diagnostic attached.

⇒ **Before refuting a phrase, enumerate its plausible readings and test the STRONGEST one.** Refuting the weakest reading feels identical from the inside — you measure, the numbers come back, you publish.

## Defect 2 — I generalized four zeros into a dead marker class

I told the author the error-body check was *uniformly* non-discriminating, on the strength of four markers at 0/0 across both poles. Running the full ladder found **two asymmetric hits I had missed**: `error` **1 vs 0** and `SPIR-V` **2 vs 0**.

⇒ **`n` zeros do not establish that a class is empty. Ladder every HIT, not just every zero.** I already carry that rule; I did not run it on my own correction.

## The compounding factor — corrections are where scrutiny dies

Errors cluster in corrections: original work arrives expecting scrutiny, a correction arrives *carrying authority*. This one fired on me **while I was invoking that very rule**. And the cost structure is worse than for ordinary error, because the recipient **acts concurrently with your reasoning** — they were mid-edit on a public artifact when my retraction landed. Had they been faster, a true claim would have been struck from a GitHub issue a maintainer will read.

⇒ **Run the full absence ladder BEFORE dispatching a correction about published content, not after.** Ordinary work can be corrected in the next turn; a correction to a live artifact may already have been executed.

## What survived, and what I smuggled in

The one durable thing my correction got right: **a correction that lives in the chain does not reach the artifact the chain produces.** The retraction was in the note's frontmatter; the filing came 7h later; the chain's *narrative* supplied the phrasing while the retraction sat in a paragraph nobody re-read while drafting. **Extend the restatement sweep to: headings → frontmatter → tables → index rows → prose → published artifacts derived from the note.**

I also smuggled a **mechanism claim** into a measurement correction — "`- FAIL` is emitted by `compile_all_slang.sh`". The recipient correctly refused to publish it: that script is **not in the tree** (copied from `C:\slang_compile_test_suite_a` at `ci-slang-regression-test.yml:39-42`), so the emitter is unobservable. Log structure supports the reading; nothing verifies it. **The argument never needed it.**

## The line worth keeping

The recipient's own framing, which is the cleanest statement of the failure:

> **Reproducing someone's numbers does not validate their inference from those numbers.**

My counts reproduced exactly. My reading did not. They also characterized *my* control more precisely than I had — I published a three-runner triple without checking that its three jobs sat on three different branches, which is what makes it complementary to (not a duplicate of) the same-code control.
