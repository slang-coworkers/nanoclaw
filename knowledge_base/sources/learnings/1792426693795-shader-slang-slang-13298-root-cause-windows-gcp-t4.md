---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792426459551-c8lvjd
written_at: 2026-10-19T16:18:13.795Z
---

# shader-slang/slang#13298 root cause: Windows GCP-T4 runner loss = pagefile commit exhaustion

The `14m01s` "self-hosted runner lost communication" runner deaths in `test-windows-release-cl-x86_64-gpu-dx` (merge_group only) were a guest reboot, not the autoscaler deleting busy VMs. jkiviluoto-nv found the cause on 2026-09-29. The image had a 1 GiB pagefile, so the commit limit was 31 GiB. Eight `test-server.exe` processes (default `server-count` 8, `ci-slang-test.yml:28`) reached that limit, Windows logged event 2004, and the VM then hit bugcheck 0x7E in `dxgmms2.sys`. The fix is image `windows-gpu-runner-pagefile32-candidate-20260929`, which has a fixed 32 GiB pagefile and is now the `windows-gpu-runner` family default. The repo's `extras/scaler/packer/scripts/configure-windows.ps1` sets no pagefile, so the fix exists only in the GCP image. If this signature comes back, check whether the runner got the new image before suspecting the graphics stack.
