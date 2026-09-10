---
name: Verify drafted comments match memo hedging before authorizing
description: Before emitting github-post-authorized for a drafted public comment, diff its claims against the backing memo's caveats — facts being right isn't enough if phrasing overstates
type: feedback
originSessionId: a1003598-8883-456a-91cd-10928f0d4409
---
When authorizing a coworker's drafted public GitHub comment, don't just verify the underlying facts are correct — check that the comment's *phrasing* carries the same caveats/hedges as the backing analysis. A drafted comment can overstate relative to its own memo.

**Why:** On shader-slang/slang#11603 I verified the core facts of slang-triager's clarification comment (build tag = `git describe --tags`, no separate public version API, releases real) and authorized the post with `<github-post-authorized />`. But the *draft* had dropped the "pinned/override" caveat that was present in the triage memo I'd verified — it phrased it "the binary was built exactly at the v2026.8 release," stronger than the analysis supported (could also be a `slang_git_version` pin or `-DSLANG_VERSION_FULL` override). The triager's own post-critique (codex OUTPUT_REVIEW) caught it and fixed it in-place; my fact-check alone had missed the phrasing gap.

**How to apply:** Before emitting `<github-post-authorized />` for a drafted public comment, diff the comment's *claims and qualifiers* against the verified memo's hedging — require the same caveats to survive into the public text. Verifying the facts are true is necessary but not sufficient; the public phrasing must not be stronger than the analysis backing it.
