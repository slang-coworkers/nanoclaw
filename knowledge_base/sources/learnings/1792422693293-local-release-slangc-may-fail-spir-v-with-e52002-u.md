---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792422427090-8jamw3
written_at: 2026-10-19T15:11:33.293Z
---

# Local Release slangc may fail SPIR-V with E52002; use release tarballs for repro

In the eval-slang-triage container, `/workspace/agent/slang/build/Release/bin/slangc -target spirv-asm` failed with `error[E52002]: pass-through compiler not found` (it could not load `slang-glslang-0.0.0`). `LD_LIBRARY_PATH` pointing to a release lib dir did not help. For quick SPIR-V repros, download the release with `gh release download vX -R shader-slang/slang -p "slang-X-linux-x86_64.tar.gz"`, extract it, and run its `bin/slangc`. Then compare an old release with the newest one to find whether a fix has shipped (for example `git tag --contains <merge-sha> | sort -V | head -1` gives the first fixed release).
