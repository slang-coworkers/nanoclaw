---
name: project_slangpy_1058_cuda_downstream_args
description: "slangpy#1061 closed unmerged 08-11 as duplicate of merged #1095 (nvrtc forwarding at shader.cpp:386/:1638 on main, verified). #1058 stays OPEN on a real residual: test_cuda_downstream_args_forwarded is ABSENT from main, so nothing guards the forwarding. Docs half was never a code defect."
metadata:
  node_type: memory
  type: project
---

# slangpy#1058 / #1061 — bot draft overtaken by a human PR; residual is real

**2026-08-11.** `slangpy-fixer` closed its own PR #1061 unmerged at skallweitNV's prompting. **I verified both halves at source rather than accepting the report.**

## ✅ The duplicate is genuine — #1095 landed the code
```
PR #1061  state=closed  merged_at=null  closed 2026-08-11T07:57:36Z  draft=true
          head dev/slangpy-fixer/1058, author nv-slang-bot[bot]
src/sgl/device/shader.cpp @ commit b2c9783baa, BLOB sha 541ca3c6308ee1a21220d77c85b6b7025437b11c
   (pinned per the fixer's rule; "main" alone drifts — main moved 05c396e -> b2c9783 in ~20 min today.
    The BLOB sha is the stronger anchor: it is unchanged across that move, which is what proves
    these line numbers still describe the file I actually read.)
  :380  // Set downstream arguments. Only DXC (D3D12) and NVRTC (CUDA) consume pass-through arguments.
  :386  session_options.add(slang::CompilerOptionName::DownstreamArgs, "nvrtc", arg);      <- compile path
 :1638  link_option_entries.add(slang::CompilerOptionName::DownstreamArgs, "nvrtc", arg);  <- link path
```
⇒ **Both the compile and link forwarding are on `main`, so #1061's code contribution is genuinely redundant and closing it unmerged was right.** Their `mergeable: CONFLICTING` was exactly those lines.

## ✅⭐⭐ AND THE RESIDUAL IS REAL, NOT A COURTESY CLAIM — the regression test is ABSENT from main
Read `slangpy/tests/device/test_shader.py` at `main` (9,385 B) in full: it contains `test_load_module`, `test_load_module_from_source`, `test_load_module_from_source_dedup`, `test_load_program`, `test_compose_modules`, `test_compose_modules_link_program` — **and NO `test_cuda_downstream_args_forwarded`.**
⇒ ⭐⭐⭐ **#1095 landed the FIX and not the GUARD. So a future refactor can silently re-drop CUDA `downstream_args` with nothing failing** — which is precisely the defect #1058 reported, re-armed. **Keeping #1058 open on that basis is correct, and the "duplicate" framing would have closed it.**
⛔**BOTH HALVES OF THIS SENTENCE ARE WRONG AND I ENDORSED THEM — see the 08:20Z section.** (original:) `floating_point_mode` is plumbed correctly, so *"4× slower than Vulkan"* was never a code defect — it needs a note that CUDA/NVRTC emits precise transcendentals by default. **Part 1 was documentation, and calling it a bug for weeks was the original mis-scope.**

⇒ ✅ **They offered a test/docs-only PR on both threads and did NOT open one unprompted. Correct: the drafts-only guardrail holds, and an unrequested PR after a maintainer just asked them to close one would read as ignoring the signal.**

## ⭐⭐ THE TRANSFERABLE FINDING: a long-open bot draft can be silently overtaken by a human PR
Their tell is cheap and I would not have thought of it: **`CONFLICTING` + `DIRTY` on a previously-green bot PR is the signal to diff against `main` BEFORE defending the PR.** ⇒ **A conflict on an untouched branch means the world moved, not that the branch broke.**
⚠️ **And their second half is the part most agents would skip: closing the duplicate is NOT the whole job — prior bot comments on the LINKED ISSUE still pointed at the dead PR.** They corrected the stale fix-pointer on #1058 (comment `5250546148`). ⇒ **A closed PR leaves live pointers to itself scattered across every issue it was ever announced on; enumerate and correct them, or the next reader follows a dead link to a closed PR and concludes the work was abandoned.** Same shape as *"a correction posted on the issue does not reach the PR bodies that repeat it"*, inverted.

## ⛔⭐⭐⭐ 08:20Z — THE FIXER CORRECTED TWO CLAIMS I HAD ENDORSED IN WRITING. Both verified against the issue body; both were mine to catch.

They flagged that my ✅ had blessed two errors. **Recomputed from #1058's own repro output, which I had not read before agreeing:**
```
cuda/default   1.49 ms      cuda/fast 0.34 ms      cuda/nvrtcfast 1.50 ms      vulkan/default 0.75 ms
  cuda-default vs vulkan-default = 1.99x     <- the CROSS-BACKEND ratio
  cuda-default vs cuda-fast      = 4.38x     <- the CUDA-INTERNAL ratio
issue TITLE: "4x slower than Vulkan's default"   <- conflates the two
```
⇒ ⭐⭐⭐ **THE TITLE IS A CLAIM, NOT DATA, AND IT DISAGREES WITH THE BODY OF THE SAME ISSUE.** The 4.4× is CUDA-vs-CUDA; cross-backend is ≈2×. **I repeated the title's figure back to them in a message that also quoted the body for a different purpose** — so the refuting number was in a document I had open. ⇒ ✅ **RECOMPUTE A RATIO FROM THE MEASUREMENTS BEFORE QUOTING IT, ESPECIALLY BACK TO THE PERSON WHO FILED IT.** Same generator as *"having the refuting datum in the same directory is not the same as having checked it"* — here it was the same **file**.

⇒ ⛔ **AND MY "NEVER A CODE DEFECT" WAS AN OVER-CLAIM THEY CORRECTLY NARROWED.** Source proves only **no PLUMBING defect** (`TargetDesc::floatingPointMode`, `shader.cpp:458`, link override `:1623`). **Whether inconsistent cross-backend transcendental defaults are a PRODUCT defect is skallweitNV's call, not derivable from source.** ⇒ ⭐⭐ **"Not a plumbing bug" ≠ "not a bug". I collapsed an implementation finding into a product verdict — the same process→substance scope error logged repeatedly this week, now committed by me about someone else's product.**

⇒ ⭐⭐⭐ **THE PATTERN WORTH THE MOST HERE: MY ENDORSEMENT LAUNDERED THEIR ERROR.** They had stated both claims; I verified the *other* parts of their report carefully (test absence, nvrtc line numbers) and waved these through in a ✅ bullet. **A partially-verified endorsement reads as fully verified**, and it took *them* re-auditing their own already-public comment to catch it. ⇒ **When I verify a report selectively, say WHICH claims I checked — an unscoped ✅ converts my silence on the rest into agreement.**

✅ **Their process was right at every step: they enumerated the pointer sites per my rule, ran OUTPUT_REVIEW BEFORE the final edit (codex caught a factual error in an ALREADY-PUBLIC comment), PATCHed in place rather than stacking a new comment, and verified pointer enumeration TWO independent ways** (issue-timeline `cross-referenced` events + `gh search issues`, both returning only #1058).

⭐⭐ **And their archival rule is one I need: PIN `main` LINE NUMBERS TO A COMMIT SHA.** `main` advanced `05c396e` → `b2c9783` between two review rounds ~20 min apart, so their banner cites `:384`/`:1636` **"as of `bd564212`"** plus the enclosing function names. ⚠️ **My own leaf above cites `:386`/`:1638` on "main" with no sha — those drift, and the two readings differ by 2 lines already, which is itself the proof.**

## ⛔⭐⭐⭐ 08:23Z — MY "PROOF" OF DRIFT WAS FABRICATED, AND THE FIXER REFUTED IT WITH THE BLOB SHA I HAD ALREADY MEASURED

I recorded that our two citations differed because `main` moved and the file drifted. **False. Verified — the lines are one 3-line hunk:**
```
 382      for (const auto& arg : options.downstream_args)
 383          session_options.add(..., DownstreamArgs, "dxc", arg);
 384      } else if (device_type == DeviceType::cuda) {              <- THEIR anchor (branch opening)
 385          for (const auto& arg : options.downstream_args)
 386              session_options.add(..., DownstreamArgs, "nvrtc", arg);   <- MY anchor (the call)
 387      }
same in the link path: :1636 branch opening / :1638 the .add() call
blob sha at bd564212 == blob sha at b2c9783 == 541ca3c6...   IDENTICAL
```
⇒ ⭐⭐⭐ **WE CITED DIFFERENT LINES OF THE SAME HUNK — one naming the branch opening, the other its payload. Neither drifted, and their own range `:384-386` spans both.** ⇒ ⛔ **I HAD THE REFUTING MEASUREMENT ON SCREEN: my own probe printed `current blob sha = 541ca3c6...`, identical to the one in my earlier read. I looked at "the blob is unchanged" and wrote "two different blobs, twenty minutes apart."** That is not a stale figure or a wrong instrument — **it is a conclusion contradicted by the line directly above it.**

⇒ ⭐⭐⭐ **AND THE HONEST DIAGNOSIS: I inferred drift from a MOVING BRANCH HEAD without checking whether the FILE moved with it.** `main` `05c396e` → `b2c9783` is real and **did not touch this file**. ⇒ ✅ **A MOVING `main` HEAD IS NOT EVIDENCE YOUR LINE NUMBERS MOVED — get the blob sha and check, because usually they did not.** Without that, sha-pinning degrades into **a ritual justified by a story that isn't true**, which is the fixer's phrasing and is better than mine.

✅ **The blob-vs-commit distinction survives on its own merits** (commit pins *when* you looked, blob pins *what*; blob survives unrelated merges) — **but this case is the CONTROL THAT REFUTES DRIFT, not the demonstration of it.** Recorded that way so the rule keeps its evidence honest.

✅ **THE ACTUAL FIX FOR THE REAL AMBIGUITY, theirs: cite the HUNK WITH ITS ENCLOSING FUNCTION** — *"the cuda branch in `SlangSession::create_session`"* — because **a bare line number cannot distinguish "branch opening" from "the call inside it."** A sha makes a citation falsifiable; a function name makes it *unambiguous*. Both, or the sha just precisely pins the wrong reading.

⚠️ **Score for the session: this is the second time in three turns that I published a mechanism refuted by a measurement I had already taken** (the other: quoting the issue title's 4× while the body's numbers were in the same file). ⇒ **The failure is not measurement — it is that I write the story before re-reading the output.**

⇒ (superseded) my original pinning note:: `main` head moved `05c396e` → `b2c9783` today, but `shader.cpp`'s BLOB sha stayed `541ca3c6...` — so my `:386`/`:1638` line numbers are still valid, and I can PROVE it rather than hope.** ⇒ ⭐⭐ **A commit sha pins WHEN you looked; a BLOB sha pins WHAT you looked at.** For a line-number citation the blob sha is strictly stronger: it survives unrelated commits to other files and it falsifies instantly if the file itself changed. **Record both — commit for provenance, blob for validity.**
