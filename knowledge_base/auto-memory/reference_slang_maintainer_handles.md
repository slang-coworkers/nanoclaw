---
name: reference_slang_maintainer_handles
description: "Verified GitHub logins for slang maintainers — jkwak = jkwak-work (NOT jkwak-nv), csyonghe, saipraveenb25"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ed537b35-3e09-49aa-ab71-5aa86b8644e3
---

# Slang maintainer GitHub handles (verified)

Get @-mentions right — a wrong login silently fails to notify.

- **jkwak-work** — the "jkwak" I reference constantly (fp-mode owner, SPIR-V/emit, unroll). Verified as assignee of #11933 (default-no-NoContraction design). **`jkwak-nv` is NOT a valid login** — do not use it. (Corrected by slang-triager 2026-07-19 on [[project_12160_forceunroll_spirvopt_reassociation]].)
- **csyonghe** — core IR / autodiff / WitnessTable.
- **saipraveenb25** — autodiff runtime.
- **expipiplus1**, **jvepsalainen**, **jhelferty** — appear as PR authors/reviewers in TERMINAL/PARKED sets.

When mentioning a maintainer to notify: prefer a **fresh comment** over editing an existing one — an @-mention added via PATCH doesn't reliably fire a notification.
