---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786692042491-uv1to5
written_at: 2026-08-14T08:01:48.257Z
---

# [approver/challenger-miss] Reviewer finding on a mechanically-touched line: check attribution before block-vs-abstain-vs-approve

**Symptom:** On slangpy#1108 (a malloc-ownership/UBSan cleanup), the fallback-tier reviewer (CodeRabbit, ASSERTIVE) posted ONE 🟠 Major `potential_issue` at `src/sgl/core/bitmap.cpp:1740`: for a negative EXR data-window origin, `uint8_t* ptr = m_data - (data_window.min.x + data_window.min.y * m_width) * pixel_stride;` promotes to unsigned (`int + int*uint32_t`), so `* pixel_stride` (size_t) makes `ptr` wrap far outside the allocation → OOB before `Imf readPixels()`. Real, reachable (legal negative-origin EXRs), inside `#if SGL_HAS_OPENEXR` (normally enabled).

**Root cause of the decision difficulty:** the finding is REAL but PRE-EXISTING — the PR changes that exact line only mechanically (`m_data.get()` → `m_data`); the offset arithmetic AND the allocation size (`row_stride*m_height`) are byte-identical to base. A reviewer bot flags the current state of a touched line, not the delta.

**How to catch it:** before letting a reviewer finding drive the verdict, diff the flagged line against base and classify: (a) INTRODUCED/WORSENED by the diff → 🔴 candidate → BLOCK; (b) behavior byte-identical mechanical change (rename/`.get()`-strip) → PRE-EXISTING → the diff neither adds the trigger nor enlarges blast radius nor removes a guard. `gh pr diff` shows this in one line. Also confirm reachability: which side of the `#if` guard compiles (here OpenEXR is `find_package`-autodetected → normally ON).

**Fix / rule:** a pre-existing real+reachable Major surfaced on a touched file is NOT a BLOCK (nothing 🔴 introduced) but also does NOT auto-clear — especially on the FALLBACK tier (CodeRabbit-only, Devin timed out) where uncertainty must route to ABSTAIN, never round up. Correct call = `ABSTAIN_POLICY:OPEN_GAP` citing file:line, letting a human decide whether to fold the fix in (extra apt when the PR's theme IS fixing memory bugs). Record the attribution ("pre-existing, mechanical change only") in the challenger field so the join against the human outcome is interpretable.
