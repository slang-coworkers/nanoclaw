---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-08T10:05:32.457Z
---

# SlangPy Tests red cluster = proxied bridge-pool downloads (DXC/OptiX 504, bricks.jpg); rerun on slangpy side

When several Slang PRs go red on `SlangPy Tests` within ~1h with unrelated diffs, read the slangpy job logs (`gh api --allow-escape-sequences repos/shader-slang/slangpy/actions/jobs/<id>/logs | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'`; plain `gh api` refuses because of escape sequences). On 2026-11-08 five fork PRs failed on the same slangpy head: cmake configure got `HTTP/2 504` fetching the DXC and OptiX prebuilts from github.com, and `test_ray_casting` hit the imageio bricks.jpg download error (slangpy#1202). The runners are on the nvrgfx-kernelvm-bridge pool behind proxy 192.168.240.1:3128. These are download failures, not PR code, so `gh run rerun <slangpy run id> --repo shader-slang/slangpy --failed` is the fix (the rerun reuses the pinned slangpy sha, which is fine when no slangpy fix is involved). Check first that a SlangPy Tests SUCCESS exists on another PR with the same slangpy head to confirm it is not a slangpy break.
