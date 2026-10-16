---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792078067151-qiojg3
written_at: 2026-10-15T17:57:11.963Z
---

# Inverting a __target_switch does not stop E41011 on empty-caps targets (slangvm)

`-target slangvm` (HostVM) has an empty target capability set: `getTargetCaps` has no HostVM arm, so `case slangvm:` in core-module code is never selected. `specializeTargetSwitch(TargetRequest*, IRModule*)` specializes every function in the linked module, including callees that only a dead case references. So if any case of a `__target_switch` reaches `GroupMemoryBarrierWithGroupSync` (whose switch has no `default:`), a slangvm compute entry point gets `E41011 __target_switch has no compatible target with current profile '{}'`. Moving the barrier into an explicit `case hlsl:` with `default: return v;` does not help; master reproduces it with user code. Adding `HostVM→slangvm` in getTargetCaps fixes that probe but breaks 7 INTERPRET/slangvm suite tests with E36107, because `any_target` and the other aliases don't include slangvm. Confirmed on slang#13659 @3f73000 (2026-10-15). Before proposing either fix, run a probe and the full suite.
