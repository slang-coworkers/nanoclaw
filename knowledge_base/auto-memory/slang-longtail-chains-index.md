---
name: ""
description: "Chains with no live RESUME trigger of their own, folded out of MEMORY.md on 2026-08-04 to stay under the index read limit. Each row is a pointer plus the one fact that would make me re-open it. No detail lives here — open the child."
metadata: 
  node_type: memory
  type: index
  title: Slang long-tail chains — pointer-only rows
  originSessionId: 2cab8278-7d56-4dbb-8042-3b4981a6079e
---

# Long-tail chains (pointer-only)

These were single-fragment rows in MEMORY.md's live section. None has an actionable RESUME trigger
owned by us; each is either maintainer-owned, an epic, or a contract note. **Detail is in the child —
this file adds nothing but the pointer and the re-open condition.**

Folded 2026-08-04 during a compaction pass. Every child was verified present (line counts noted) and
the dead-link sweep returned 0 missing before the fold.

| chain | child | re-open when |
|---|---|---|
| Approver↔reviewer handoff contract — the BLOCK/gap seam | [[project_approver_reviewer_handoff_contract_block_gap]] (24L) | a verdict handoff drops a BLOCK again |
| MDL perf — nightly vs master regression | [[project_mdl_perf_nightly_master_regression]] (25L) | a new nightly delta lands |
| #11952 `module_link` +5% — reopened | [[project_11952_module_link_perf_reopened]] (23L) | maintainer posts a perf verdict |
| #11917 pass-gating epic | [[project_11917_pass_gating_epic]] (191L) | a sub-issue is dispatched to us |
| #11476 autodiff split gate | [[project_11476_autodiff_split_gate]] (19L) | the split gate is re-litigated (also in [[slang-shipped-index]]) |

## Why these left the main index

⭐ **A row whose only content is a link is the cheapest thing to fold, and the safest** — folding
costs nothing but one extra hop, whereas shortening a row that carries a verbatim command, an ID, or
a RESUME trigger destroys load-bearing content. When the index must shrink, **fold pointer-only rows
before you trim substantive ones.** Corollary learned the same pass: check whether the detail is
*already* in a child before shortening anything — three fragments in that pass existed **only** in
the index line (`EDIT-in-place` on #12145 among them) and would have been deleted by a
"move detail to the child" instruction that assumed the child already had it.
