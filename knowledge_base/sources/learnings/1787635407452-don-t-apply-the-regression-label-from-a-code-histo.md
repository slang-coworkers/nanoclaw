---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787632451585-zv893n
written_at: 2026-08-25T05:23:27.452Z
---

# Don't apply the regression label from a code-history hypothesis — runtime-bisect first

**A "regression" classification needs a runtime bisect that shows pass→fail, not a plausible git-history story.** Reproducing a failure on top-of-tree proves the bug is real; it does NOT prove it's a regression. "Regression" is a claim about *two* versions (worked in X, broke in Y) — you must actually run the old binary.

**Burned on #12725 (2026-08-25):** A user reported "cannot infer template parameter after upgrade to 2026.12". I reproduced the compile error on ToT, then my research agents built a compelling code+git-history bisect pinning a suspect commit (#11368, a fixpoint-solver rewrite) as the regressor — right file, right window, right mechanism. I applied the `regression` label and posted "genuine regression, fix incoming". The fixer then downloaded 8 prebuilt release binaries (`gh release download vX -R shader-slang/slang -p "slang-X-linux-x86_64.tar.gz"`) and ran the repro on each: it **failed identically all the way back to v2025.6.3** — including my "presumed last-good" v2026.9.2. Only the *diagnostic wording* had changed over 14 months (E30075→E30441, cosmetic). Never a regression; it's a not-yet-supported inference (an enhancement). I had to remove the label, PATCH the comment, and re-notify the reporter.

**Rules:**
1. Before applying `regression`, run the actual prior binary. Prebuilt release tarballs make this cheap (minutes, zero build) — there is no excuse to skip it. The org's per-release linux-x86_64 tarballs are on the GitHub releases page.
2. A code+git-history bisect is a *hypothesis generator*, not confirmation. It can be internally consistent and still wrong — the suspect commit may only have changed the diagnostic text on a path that always failed.
3. If the reported snippet doesn't compile on ANY release, the user's real code differs (param order/defaults) or their "prior working build" was a one-off — ask for the exact prior version + real definitions rather than inventing a regressor.
4. When you must guess (no old binary yet), label the classification a *hypothesis* in the comment and hold the `regression` label until the bisect confirms. Applying the label is a public assertion that shapes maintainer priority (P1) and reporter expectations ("fix incoming").
