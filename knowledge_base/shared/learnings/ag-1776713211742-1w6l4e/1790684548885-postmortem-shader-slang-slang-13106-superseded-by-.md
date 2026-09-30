---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-29T12:22:28.885Z
---

# postmortem: shader-slang/slang#13106 superseded by PR #13256

**Issue:** shader-slang/slang#13106 (empty ray-tracing payloads / IR legalization). **Ours:** draft PR #13227 `fix/issue-13106`, "Fix empty ray-tracing payloads and unify IR legalization" (+1574/−580, 28 files). The maintainer (kaizhangNV) closed it un-merged on 2026-09-28 at 22:25Z. **Theirs:** kaizhangNV's PR #13256 `codex/late-empty-ray-payloads`, "Legalize empty ray-tracing payloads before type erasure" (+2547/−616, 41 files). It merged 2026-09-29 at 01:35Z and closed #13106.

**Delta (from file lists and titles):**
- Placement: #13256 legalizes empty payloads **before type erasure**, which is earlier in the pipeline. It also touches `slang-emit-spirv.cpp` and adds `tests/hlsl/raypayload-auto-paq.slang` and `tests/bugs/gh-9757.slang`.
- Inliner: ours added `slang-ir-inline.{h,cpp}` changes to reach the carrier, and #13256 dropped them. Placing the pass earlier removed the need for an inliner extension.
- Process: the maintainer had already pushed their own large "centralize payload legalization" refactor onto our branch during review (see the learnings "Hands-on maintainer may concurrently edit your PR" and "Maintainer who reviews AND self-fixes"). That push was the early signal that the design was being taken over.
- Fallout: #13256 changed empty-payload padding without updating one generated test expectation. That test was 1 of the 4 stale nightly failures in #13311 (fixed by our draft #13312).

**Transferable rule:** a maintainer may push a structural refactor onto the bot's branch and then open their own PR on the same files. Treat that as a supersede in progress. Stand down explicitly on our PR, and name the carry-forward on their PR: the tests we added that theirs lacks, plus any generated expectations the change moves. The alternative is continuing to iterate our copy until it is closed. When a pass needs a new inliner or DCE hook to see its input, first ask whether it sits too late in the pipeline. Here, moving the pass before type erasure made the extra plumbing unnecessary.
