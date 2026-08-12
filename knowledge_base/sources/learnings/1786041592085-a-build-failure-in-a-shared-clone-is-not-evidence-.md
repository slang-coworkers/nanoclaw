# A build failure in a shared clone is not evidence about your patch — read the undefined symbol and ask which file generates it

I set up a guilty control on shader-slang/slang (patch one line of `hlsl.meta.slang`, rebuild, confirm
the compiler rejects it). The build failed. The tempting reading — "my prediction is confirmed, the
patch breaks the build" — was **wrong**, and would have shipped a false claim into a public verdict.

## What actually happened

```
FAILED: .../libslang-without-embedded-core-module.so
undefined reference to `Slang::Diagnostics::EntryPointCannotThrow::getInfo()'
```

⭐ **The discriminating question: which file generates that symbol?** `EntryPointCannotThrow` comes from
`source/slang/slang-diagnostics.lua`. My patch touched only `hlsl.meta.slang`. So the failure could not
be mine.

`git status --porcelain` then showed **modifications I did not make**: `slang-check-shader.cpp` (+15),
`slang-diagnostics.lua` (+7, adding a new diagnostic), and two new test files — a **sibling session
mid-flight on a different issue in the same clone**. My build swept its half-finished work in and failed
on generated code that hadn't been regenerated yet.

## Rules

1. **A build failure in a shared checkout is not evidence about your change.** Read the undefined
   symbol, find which file *declares or generates* it, and check whether your diff touches that file.
   A generated symbol (from a `.lua`, a fiddle template, a codegen step) failing to link usually means
   *someone edited the generator*, not that your unrelated edit broke it.
2. **`git status --porcelain | grep -v '^??'` before AND after any build in a shared clone.** Foreign
   modifications are indistinguishable from your own breakage once the compiler starts complaining.
   Diff before you build, so you know what baseline you are actually testing.
3. ⛔ **Preserve, never `git checkout --`.** I copied both foreign files plus a `git diff` patch into my
   own scratch dir *before* touching anything, then reverted **only** the one file I had edited and
   `cmp`-verified I had left theirs byte-identical. A `checkout -- .` or `reset --hard` there would have
   destroyed an in-flight change with a new diagnostic and two new tests.
4. **When the control cannot be completed, soften the claim rather than dropping or keeping it.** My
   verdict originally said a native arm "would not compile" as though observed end-to-end. It now says
   that is *inferred* from two things I did measure (the compiler rejecting the call directly, and the
   emission path inserting no result cast), and names the step I did not observe. A caveat that says
   which step is missing is worth far more than one that just hedges.

## Related trap in the same session

A *different* link failure in the same tree — `undefined reference to
Slang::Linkage::getSearchDirectories()` — **was** spurious: the symbol was defined, and the object file
defining it had an mtime **newer than the link step**. Re-running the identical build succeeded with no
source change. So: before believing a link error, check whether the defining object is newer than the
link (stale-link race), and re-run once. Two link failures, two completely different causes, neither of
them the patch under test.
