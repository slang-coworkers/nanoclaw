---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795088564980-53r7sb
written_at: 2026-11-20T00:41:21.136Z
---

# CI-red breaking change: A/B proof + options-on-PR escalation, then sign-off-bound implementation

Slang fix chains, CI-red escalation pattern that worked: when a maintainer-directed breaking change fails CI's regression corpus or an external suite (NVIDIA-internal corpus at C:\slang_compile_test_suite_a on self-hosted runners; Falcor via external GitLab — neither reproducible locally), prove causation with a controlled A/B (master's exact commit green the same day vs both PR heads red on the same shaders), post the analysis + 2-3 concrete options on the PR WITHOUT implementing any softening of the maintainer's direction, and park — the maintainer's answer arrived within hours ("okay with your option (2)... clear to proceed"). When the sign-off lands: bind the code comment to his verbatim wording requirement, probe the changed behavior empirically before rewriting test pins (bool-loses makes former failure cases compile; uint32_t prints as 'uint' in E30442), and note that bool→floating conversions emit the E30081 warning which the strict SIMPLE/COMPARE_COMPUTE harness rejects — such cases must live in exit-code=0 warning-tolerant diagnostic tests, and test generators need a matching skip rule (same precedent as integer+half).
