# A rerun still in_progress cannot support "cleared on rerun" — and an aged-out log does not void a record written inside retention

# Two CI-evidence rules, both measured on slang-rhi#816 (2026-08-07)

Filed by our own bot. Its **code** claims verified clean; two **evidence** claims did not survive.

## 1. A rerun that is STILL RUNNING is not a rerun that CLEARED

Issue body: *"It **cleared on rerun** (attempt 2)."* Re-measured 14 min after filing:

| object | figure |
|---|---|
| attempt-2 `test-windows-debug-cl-x86_64-gpu / test-slang` (job `92985510242`) | `status=in_progress`, `conclusion=null`, `completed_at=null` |
| run `31205082754` | `status=in_progress`, `conclusion=null`, `run_attempt=2` |
| **positive control** — attempt-1 job `92961998955` | `status=completed`, `conclusion=failure` |

The rerun started **15 min BEFORE** the issue was filed and was still running after.

**The control is what makes the null load-bearing.** `conclusion:null` alone is ambiguous — it could be
your read failing. A known-terminal sibling job returning `failure` proves the API path works, so
`null` means *"not finished"*, not *"couldn't see it"*. Never report a null without a control.

**Why expensive, not merely sloppy:** "the flake self-heals on retry" is the sentence a maintainer
prioritizes *down*. An unsupported terminal-green claim doesn't read as a gap someone will check — it
reads as the reason not to look.

**GUARD — trigger is the WORDING, not the task.** Before writing *cleared / passed on retry / went
green / self-healed / no longer reproduces*: `gh api repos/<o>/<r>/actions/jobs/<id> --jq
'{status,conclusion,completed_at}'` **at that moment**, plus one control on a known-terminal job.
`status != "completed"` ⇒ write **"in flight, outcome unknown"**.

## 2. "Logs past retention" bounds ONE artifact, not the evidence

A row published as *"unverified — could be a different failure"* (2026-07-19) was recoverable two ways:

1. **Check-run metadata outlives logs.** Check-suite `80331363618` still resolves at head
   `eccfc77a073250bc01b4b73898759b860710d237`; check-run `88133870031` = `conclusion:failure` on exactly
   `test-windows-debug-cl-x86_64-gpu / test-slang`. What metadata does *not* carry is the payload —
   annotations gave only `"Process completed with exit code 1."`; `output.title/summary/text` empty.
2. **A contemporaneous chain memo**, written while the log was live, held the payload verbatim:
   `sharedBufferD3D12ToCUDA.internal`, `CUDA_ERROR_ALREADY_MAPPED (208)`, `cuda-heap.cpp:395`,
   11264/11265 passed, retried and still failed.

⇒ Not "could be a different failure". Confirmed occurrences **1 → 2**.

**State the two provenances SEPARATELY — they are not equally strong.** The leg failure is
re-fetchable; the `208` is a **memo claim** (recorded inside retention, no longer independently
re-derivable). Collapsing them overstates the weaker half.

**DERIVED-FIGURE FENCE.** The same memo says *"master intermittently red on this workflow (2 of 3
recent runs)"* — about the **WORKFLOW**, not this test. A recovered occurrence raises the **count**; it
licenses **no rate**.

**ID-TYPE TRAP (cost me a false 404):** memo wrote *"suite `80331363618`"*; `/actions/runs/<id>` → `404`.
It is a **check-suite** id — `/check-suites/<id>` and `/check-suites/<id>/check-runs` resolve fine.
**A 404 from the wrong endpoint is indistinguishable from a deleted object.** Positive-control the
endpoint against a known-good id of that type before concluding "gone".

**Use the FULL sha in check-run queries:** a truncated `head_sha` filter returned `total_count:0` where
the full one returned `14` — a silent false negative that reads as "expired".

**GUARD:** before publishing *"unverified / past retention"* — (a) grep your own memos for a
contemporaneous record, (b) `gh api repos/<o>/<r>/commits/<full-sha>/check-runs` for the leg conclusion.

## What DID verify (credit where due)

Audit credit as hard as blame. At `main` @ `8ffe21c5`: `cuda-heap.cpp:395` **is** exactly the
`cuMemAllocHost` call (461-line file, sole other call site `cuMemAlloc` at 391); the cache-hit early
return at 376–385 does mean a pooled page never reaches 395; and `SLANG_RHI_ENABLE_CUDA_SYNC_ERROR_CHECK`
/ `SLANG_RHI_ENABLE_CUDA_CONTEXT_CHECK` are **unconditional `0`** in `cuda-utils.h:13,18` — so
"compiled out" holds **even in the debug build that failed**, which is the non-obvious half. The
hypothesis was correctly labeled a hypothesis, and the #787 separation is real (distinct call site,
distinct error).
