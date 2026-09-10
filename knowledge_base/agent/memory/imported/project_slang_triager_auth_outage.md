---
name: project_slang_triager_auth_outage
description: "slang-triager provider logout (\"Not logged in · Please run /login\") — persistent 2026-07-13, blocks every chain triager owns; needs operator re-auth, NOT a restart"
metadata: 
  node_type: memory
  type: project
  originSessionId: b63b776f-b15c-43f2-90e2-00d74c7ee891
---

**2026-07-13 ~18:07–18:10 UTC — slang-triager (`ag-1780667166418-apezq5`) returning provider auth error `"Not logged in · Please run /login"`** on the #11985 thread session (`sess-1783467886710-stz8tc`, container_status=running — container ALIVE, the *model provider* auth failed on the request). Reproduced on TWO consecutive dispatches (msg #50, msg #58) → **persistent, not the self-clearing transient window seen 07-08.**

**Do NOT restart the container to "fix" this** — a `ncl groups restart` won't re-auth a provider credential (the problem is auth, not container state) and would orphan the triager's many live sessions (#11985, #11989, #11999, #12083, …) per [[feedback_benign_ack_loop_dont_restart_if_live_chains]]. This needs the **operator to re-authenticate the provider** (OneCLI vault / provider login) — a human action Main cannot perform.

**Scope (as of escalation):** appears triager-specific, NOT fleet-wide — other groups (orchestrator/main, approver `vvj8oi`, fixer `vmjrwe`) show `last_active` within minutes and are processing turns; only slang-triager returns the login error. Not conclusively proven fleet-scope (last_active updates on inbound too). If other coworkers start returning the same string, treat as a shared-credential expiry.

**Blocked work (all triager-owned):** #11985 — jkwak's closing precondition (revert PR #12075 before close, cmt 4961076388) needs the triager to investigate #12075 + disposition; also #11989, #11999 re-enable. All stalled until re-auth. Related dispatch text preserved in [[project_11985_macos_metal_capability_regression]].

**Action taken:** escalated to operator for provider re-auth (plain reply; mobile push "not sent" = Remote Control inactive, NOT a presence signal per [[feedback_push_not_away]]). Do NOT keep re-sending to the triager (burns cycles). Resume the #11985/#12075 dispatch once operator confirms re-auth.

**Update ~18:32 UTC — CONFIRMED PERSISTENT.** Error recurred on msgs #50/#58/#60/#62 (4× over ~25 min); #62 format `Error: Claude Code returned an error result: Not logged in` confirms it's the **Claude Code CLI login state**. Scope re-checked via `ncl sessions list`: PR-approver (`vvj8oi`) active 17:48, slang-reviewer (`a9tac8`) 17:03 — both AFTER triager's last healthy activity → still reads **triager-specific**, at worst Claude-provider login expiry (operator re-auth fixes either way; last_active is NOT a clean health signal since failed turns also bump it). Sent ONE consolidated operator follow-up; now going TRULY SILENT on further echoes until operator confirms re-auth — no per-echo probing/re-escalation.
