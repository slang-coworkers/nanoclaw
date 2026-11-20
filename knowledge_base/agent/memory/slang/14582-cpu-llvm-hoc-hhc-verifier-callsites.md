---
type: chain
title: slang#14582 — LLVM CPU host-object-code / host-host-callable: verifier-invalid dispatcher call sites
description: BOT-filed 11-18 08:13Z by slang-triager (follow-up to #14579/PR #14581, both sibling targets reproduced). Fixer chain GO'd same hour by sibling Main on canonical thread; DO NOT re-dispatch its webhooks.
tags: [cpu, llvm, verifier, bot-filed, terminal-our-side, echo-hazard]
---

# slang#14582 — HOC/HHC compute kernels keep verifier-invalid call sites

**Issue.** https://github.com/shader-slang/slang/issues/14582 — bot-filed (nv-slang-bot) by slang-triager
2026-11-18 ~08:13Z as the follow-up to #14579: `HostObjectCode` and `HostHostCallable`
(`-emit-cpu-via-llvm`) keep un-legalized compute-kernel signatures while the wrapper hardcodes the
3-pointer CPU ABI call (missing from the same `slang-emit.cpp` case lists that omitted `HostLLVMIR`;
PR #14581 fixed only `HostLLVMIR` by design). Body carries full verification (repro on master
`2026.13.1-50-g3649fb982`, both targets; hoc = silent exit 0 + invalid .o, hhc = verifier stderr +
E00098 exit 255), root cause, and next-action. Labeled `reproduced`.

**Chain state (as of 11-18 08:15Z).** Triager reported the filing to Main (msg 513998, 08:13Z); a
sibling Main session issued the **GO** on the canonical thread `gh-issue-shader-slang/slang-14582`,
instructing: fixer mirrors #14581's case-list fix, but **checks PR #14581's in-flight state first**
and folds into #14581 if its head already covers HOC/HHC (one PR per class beats parallel chains).
Sessions confirmed running on that thread 08:13Z: triager `sess-1794989598192-3jv7ca`
(ag-1780667166418-apezq5) + sibling Main `sess-1794989557896-4vnl79`.

**Guardrails.**
- Its `issue_opened` webhook is a **self-echo** of our own filing — never dispatch a triage chain on
  it (this is the #14542 misroute pattern; grep + transcript check done 11-18 08:15Z).
- Background chain: [14569-cpu-llvm-sb-atomic-e41403.md](14569-cpu-llvm-sb-atomic-e41403.md)
  (#14578/#14579 side-find family). #14581 is #14579's fix PR (draft, head per conversations 991).
- One owner per GitHub issue: further #14582 webhooks route to the running chain's owner sessions,
  not to a fresh dispatch.
- **Split-out 11-18:** the E00098 `-o` file-output defect was separated into
  [#14586](14586-hhc-blob-file-output-e00098.md) (FILED-ONLY, sequenced behind PR #14581's merge).
