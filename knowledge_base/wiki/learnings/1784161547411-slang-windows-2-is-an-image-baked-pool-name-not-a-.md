---
title: "SLANG-WINDOWS-2 is an image-baked pool name, not a physical host — resolve runners by runner_name"
type: learning
topic: slang-compiler
source: learnings/1784161547411-slang-windows-2-is-an-image-baked-pool-name-not-a-.md
---

# SLANG-WINDOWS-2 is an image-baked pool name, not a physical host — resolve runners by runner_name

On the Slang CI **Windows GPU test tier** (`["Windows","self-hosted","GCP-T4"]`, ci.yml:467–504), the GitHub Actions log field **`Machine name: 'SLANG-WINDOWS-2'` is an image-baked OS computer name shared across many ephemeral GCP-T4 VMs — it is NOT a physical-host discriminator.** Do not attribute "same physical runner" from matching "Machine name".

**Proof (2026-07-15, run 29454574765):** two runner agents ran **concurrently** and both reported `Machine name: SLANG-WINDOWS-2` — `win-test-a25bec8d` (runner_id 89983, release-gpu job) and `win-test-152c8e56` (runner_id 89984, debug-gpu job), both started 22:47:5xZ and overlapped. A self-hosted runner runs one job at a time, so two agents active in the same instant under one "Machine name" cannot be one host. Runner_ids across the tier are monotonic (89125→90179 in ~24h) with unique `win-test-<hex>` labels = ephemeral autoscaled registrations.

**How to identify a runner correctly:** use `runner_name`/`runner_id` from `gh api repos/shader-slang/slang/actions/runs/<run>/jobs` (jq `.jobs[] | {name, runner_name, runner_id, started_at, completed_at}`), never the log "Machine name". To test "one host vs pool," find two jobs with the same identifier whose wall-clock **overlaps** — overlap under one name ⇒ shared name / multiple hosts.

**Escalation consequence:** recurring Windows-GPU device-loss/TDR is a **pool-wide GCP-T4 driver/TDR-config or per-VM-GPU issue**, NOT a single-host quarantine. Frame the 3rd-hit escalation to the CI-fleet owner as "device-loss/TDR across the GCP-T4 Windows GPU pool (runner_names X,Y,Z + run IDs)," not "quarantine SLANG-WINDOWS-2." (Contrast #11955's linux-cpu tier, which is ephemeral GitHub-hosted ubuntu-24.04 with no host to touch at all.)

Also note: the bot's token gets HTTP 403 (`Resource not accessible by integration`) on `repos/.../actions/runners`, so you cannot enumerate the self-hosted pool directly — infer structure from per-job runner metadata + concurrency instead.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784161547411-slang-windows-2-is-an-image-baked-pool-name-not-a-.md`_
