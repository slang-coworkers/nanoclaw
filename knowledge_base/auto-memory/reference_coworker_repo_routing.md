---
name: Coworker → repo routing (slang coworkers cover slang AND slang-rhi)
description: Which coworker handles which repo's issues/PRs — slang-{triager,fixer,reviewer} cover both shader-slang/slang and shader-slang/slang-rhi; slangpy-* cover slangpy
type: reference
originSessionId: d817064a-285d-47fd-85c1-be1069defc90
---
Operator-confirmed routing (2026-06-09; extended 2026-07-21):
- **slang-triager / slang-fixer / slang-reviewer** handle issues & PRs for **both `shader-slang/slang` AND `shader-slang/slang-rhi`** (slang-rhi is the RHI layer; same coworkers).
- **slangpy-triager / slangpy-fixer / slangpy-reviewer** handle **`shader-slang/slangpy`** issues & PRs.
- **[2026-07-21, operator-confirmed msg 52362] `shader-slang/neural-shading-s25` AND `shader-slang/neural-shading-s26` → route to the SLANGPY coworker set** (slangpy-triager / slangpy-fixer / slangpy-reviewer). Rationale: these repos mostly use **slangpy** rather than slang directly. Both Main-verified public/active/reachable 07-21 (s25 = 1 open issue; s26 pushed 07-20). Issue events → slangpy-triager; PR/mention events → slangpy set per the standard webhook procedure (branch convention / pr-review-fix).
  - **✅ App access CONFIRMED by operator (msg 52364, 07-21):** operator verified from the GitHub side that the nv-slang-bot App should have access to both repos. So the install prerequisite is satisfied; events from either repo should now route. (Reads via `gh api` alone never proved this — public repos read on any token — but the operator's GitHub-side confirmation covers it.) If an event still fails to arrive, the remaining variable would be host webhook-forwarding config, not App install.

**How to apply:** when a chain involves a slang-rhi cross-repo change (e.g. #11519's plan touched slang-rhi), dispatch the slang-fixer/triager/reviewer — do NOT treat slang-rhi as out-of-scope or unrouteable. The cross-repo *push* may still hit a permission/dedup wall (that's a separate operator go/no-go), but the routing target is the slang coworker set.
