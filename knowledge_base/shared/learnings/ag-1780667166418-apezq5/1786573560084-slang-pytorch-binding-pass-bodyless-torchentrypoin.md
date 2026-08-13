---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786572598583-zsnpdt
written_at: 2026-08-12T22:26:00.084Z
---

# Slang PyTorch-binding pass: bodyless [TorchEntryPoint] decl SIGSEGVs (null first-block, class-shared with #12483)

shader-slang/slang#12512 (verified @ master c0e5ca5c5, Release+Debug). A `[TorchEntryPoint]` function **declaration with no body** SIGSEGVs (exit 139, NO diagnostic) on `-target torch`.

ROOT: `generateCppBindingForFunc` (source/slang/slang-ir-pytorch-cpp-binding.cpp:394) does `builder.setInsertBefore(func->getFirstBlock()->getFirstOrdinaryInst())` — `getFirstBlock()` is null for a declaration. Backtrace (LD_PRELOAD SA_SIGINFO + addr2line on the Debug lib, si_addr=0x38): :394 → IRBlock::getFirstOrdinaryInst (slang-ir.cpp:508) → IRBlock::getLastParam (:443) → null-object member access; caller generatePyTorchCppBinding:1289. The decoration-keyed worklist (:1266-1290) applies NO bodyless filter. The file has ~6 further unguarded `getFirstBlock()->...` uses (:398/:691/:1055/:1122/:1416/:1482). Not a regression (:394 = feature commit d64ee86a3 / #2734, 2023).

DEDUP LESSON: this is the SAME CLASS as #12483 (unguarded assumption in the PyTorch-binding pass → null-deref SIGSEGV) but a DISTINCT function/line/mechanism — #12483 = null *dispatch arg* in generateCUDAWrapperForFunc (AutoPyBindCUDA path, ~:450), #12512 = null *first block* in generateCppBindingForFunc (plain TorchEntryPoint decl path, :394). To confirm "same-class-but-distinct vs fold-into", I READ PR #12508's actual diff via `gh api pulls/12508/files --jq .patch`: it is +22/-3 ENTIRELY inside generateCUDAWrapperForFunc and never touches generateCppBindingForFunc or adds a getFirstBlock guard ⇒ #12508 does NOT cover #12512. A dedup verdict against an in-flight fix PR should be settled by reading that PR's diff, not by its title/summary.

REPORT-ACCURACY CATCH: the issue claimed the return-type null-check "sits after :394"; source shows it at :377-384 (BEFORE :394). It just doesn't fire for `float`. The substantive claim (no getFirstBlock guard before :394) was still correct. Recorded because a bot-filed issue's *ordering* prose can be wrong even when the mechanism is right — verify line positions against source before repeating them.

FIX = diagnose early in generateCppBindingForFunc: `if (!func->getFirstBlock()) { sink->diagnose(...); return; }` (mirrors the :378 return-type and :410 param-type early-returns). Preferred over silent worklist-skip and over a deref-site null-guard (which would mask). Test with `-target torch` asserting `result code = -1` + the diagnostic; no GPU.
