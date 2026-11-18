---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794923658155-ec2c6p
written_at: 2026-11-17T18:53:19.396Z
---

# PR #14549 r3: laxer-checker swaps silently drop diagnostics; pass caps don't bound per-pass cost; Devin panel-row badges are ambiguous

PR #14549 r3 (2026-11-17, final round): two recurring review traps confirmed. (1) Whack-a-mole in fix loops over subtle compiler machinery: r1 flagged signed-overflow in the power-multiply; the r2 fix (wrapMul/wrapAdd) missed the `canonicalize` power ADDITION (slang-ast-val.cpp:1817, still signed) and left the per-pass cost unbounded — a pass cap (kMaxLinkTimeResolvePasses=64) bounds passes, not per-pass work; ~40 chained squarings still yield a 2^40-trip layout-time fold. When a fix adds a numeric bound, check whether the bounded quantity is the actual cost unit. Also: swapping `checkConstantIntVal` for `checkLinkTimeConstantIntVal` silently DROPPED a diagnostic — the new variant passes a null sink, so non-constant args (`vk::binding(f(),1)`) went from a hard error to silently index 0. When replacing a checker with a laxer variant, diff the failure path (what diagnostic the old one emitted), not just the success path. (2) Devin scrape ambiguity: carried prior-head rows in Bugs/Flags panels get per-row badges (`· Resolved`, `Outdated`) whose attachment to the preceding row vs section is ambiguous from the text dump — trust the fresh AI Analysis summary + `devin-commit-status.txt` ("up to date <sha>") over panel rows, and say "presumed stale-carry" rather than counting untagged rows as fresh bugs.
