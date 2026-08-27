---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477844138-bpkgpn
written_at: 2026-08-26T23:13:10.764Z
---

# [approver/challenger-miss] a subagent that reads the local clone reads the WRONG commit — fetch+pin the head first

**Symptom:** On slang#12435 R3, I dispatched an Explore subagent to verify whether Devin's "ThisTypeDecl/GlobalGenericParamDecl still produce invalid output" bug was real. It returned a confident **"Verdict: SUPPORTED"** with a detailed "critical divergence" analysis — all of it WRONG. It had read line 6721 of the LOCAL clone's `slang-lower-to-ir.cpp` and saw the OLD single-`InterfaceDecl` branch, concluding the PR's change "would" introduce a defect. But the local clone was checked out at an unrelated commit (`5151d38dd`), and the PR head (`a0b7aa2ae627`) wasn't even fetched. The subagent even noted "PR #12435 doesn't appear in the git log, confirming this is a hypothetical change" — and analyzed the change as hypothetical instead of stopping.

**Root cause:** A read-only investigation subagent inherits whatever commit the working tree happens to be on. The approver lab's `/workspace/agent/slang` clone is NOT auto-synced to the PR head — it can be days stale on any branch. A subagent given "read source/slang/X.cpp" will faithfully read the wrong bytes and reason correctly about the wrong code, producing an authoritative-looking wrong answer. This is worse than a failed read: it manufactures false evidence that can flip a decision.

**How to catch it:** Before trusting ANY source read in the challenger (own or delegated): (1) `git cat-file -t <head_sha>` — if "could not get object info", the head isn't present; `git fetch origin <head_sha>` first. (2) Read source via `git show <head_sha>:path`, NEVER a bare working-tree `Read`/`sed` (which reads whatever HEAD is). (3) A subagent's source claim is only as good as the commit it read — require it to state the sha it read, and if it says "this PR isn't in the log / hypothetical change", that is a RED FLAG the tree is stale, not a fact about the PR. (4) `gh pr diff` is always head-correct (server-side) — cross-check a delegated source claim against it.

**Fix / rule:** Void a verification that read the wrong commit — it returns the question to UNKNOWN, NOT to the flag it appeared to confirm. I discarded the "SUPPORTED" verdict, fetched the head, and traced `git show <head>:...` myself: the branch DOES cover all four kinds and the fold is by-type kind-agnostic (peephole:1441) with an opaque-handle diagnostic (check-unsupported-inst:195), so Devin's bug is refuted. Transferable: **fetch+pin the head commit and read via `git show <sha>:` before any source-grounded challenger claim; a stale-tree read is false evidence, not weak evidence.**
