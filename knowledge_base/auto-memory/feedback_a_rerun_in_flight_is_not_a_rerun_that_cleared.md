---
name: feedback_a_rerun_in_flight_is_not_a_rerun_that_cleared
description: "\"It cleared on rerun\" asserted for a job still in_progress — measured on slang-rhi#816. Re-fetch status+conclusion at the moment you write a terminal CI verdict; in_progress+null is UNKNOWN, and a positive control proves it is not an API artifact."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35faaf43-6f61-44e5-aa36-55769e43b018
---

⛔ **A rerun that is STILL RUNNING is not a rerun that CLEARED.** "It cleared on rerun (attempt 2)" is a
**terminal** claim; a job that has not terminated cannot support it, in either direction.

**Measured 2026-08-07 (slang-rhi#816, filed by our own bot at `20:30:15Z`):** issue body asserted
*"It **cleared on rerun** (attempt 2)."* Re-measured at `20:44Z`:

| object | figure |
|---|---|
| attempt-2 `test-windows-debug-cl-x86_64-gpu / test-slang` (job `92985510242`) | `status=in_progress`, `conclusion=null`, `completed_at=null`, `started_at=20:15:08Z` |
| run `31205082754` | `status=in_progress`, `conclusion=null`, `run_attempt=2` |
| **positive control** — attempt-1 job `92961998955` | `status=completed`, `conclusion=failure` |

The rerun started **15 minutes BEFORE the issue was filed** and was still running 14 minutes after.

⭐⭐⭐ **The control is what makes the null load-bearing.** A `conclusion:null` alone is ambiguous —
it could be my read failing. Fetching a **known-terminal sibling job in the same run** and getting
`failure` proves the API path works, so `null` means *"not finished"*, not *"I couldn't see it"*.
Never report a null without a control; never report a control without the null it disambiguates.

⚠️ **Why this one is expensive rather than merely sloppy:** "the flake self-heals on retry" is exactly
the sentence a maintainer prioritizes *down*. An unsupported terminal-green claim doesn't read as a
gap a reader will check — it reads as the reason not to look. Compare an honest
*"a rerun was in flight when I filed; outcome not yet known"*, which costs nothing and stays true.

✅ **GUARD — trigger is the WORDING, not the task:** before writing *cleared / passed on retry /
went green / self-healed / no longer reproduces*, run
`gh api repos/<o>/<r>/actions/jobs/<id> --jq '{status,conclusion,completed_at}'` **at that moment**,
plus one control on a job you already know is terminal. `status != "completed"` ⇒ write **"in flight,
outcome unknown"**. ⭐⭐ **A CI state you measured minutes ago is not the state you are publishing now** —
this is the same expiry trap as [[feedback_ci_checks_at_a_sha_expire_source_at_a_sha_does_not]], but the
failure mode here is worse because the stale reading was never terminal *to begin with*.

Sibling lesson from the same artifact — the row it marked "unverified" was recoverable from my own
contemporaneous record: [[feedback_an_aged_out_log_does_not_void_a_record_written_inside_retention]].
