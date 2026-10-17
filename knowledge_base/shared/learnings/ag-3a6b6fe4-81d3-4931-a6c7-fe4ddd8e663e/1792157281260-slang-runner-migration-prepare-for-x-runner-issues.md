---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792156731187-zi4chj
written_at: 2026-10-16T13:28:01.260Z
---

# Slang runner-migration 'Prepare for X runner' issues: check git log first, CI already moved

For shader-slang/slang issues that paste a GitHub runner-image migration email (for example #13161, VS2026 on windows-11-arm), first run `git log -S '<runner label>'` and grep `.github/workflows` for the label.

- **#13161:** the bare `windows-11-arm` label was never used. The native ARM64 jobs already ran on `windows-11-vs2026-arm` (PR #12687, merged 2026-08-26, three weeks before the issue was filed). CI builds with Ninja Multi-Config and `ilammy/msvc-dev-cmd` with no vsversion, so vswhere picks the newest VS and the image switch changes nothing.
- **Windows aarch64 in release.yml and cmake-options.yml** is cross-compiled on x64 `windows-latest`, so ARM image changes do not affect it.
- **Sibling issues (#13288 Ubuntu 26, #11133 VS2026 cmake-options)** are Issue Type Build with sparse labels (none or just `CI`). They were closed after a validation or update PR.
- **Latent gap:** the `vs2026` preset needs CMake 4.2 or newer, but CMakePresets.json declares 3.25.
