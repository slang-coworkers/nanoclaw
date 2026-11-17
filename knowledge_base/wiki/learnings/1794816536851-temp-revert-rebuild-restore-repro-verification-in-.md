---
title: "Temp-revert-rebuild-restore repro verification in the shared clone + in-tree spirv-opt location"
type: learning
topic: slang-compiler
source: learnings/1794816536851-temp-revert-rebuild-restore-repro-verification-in-.md
---

# Temp-revert-rebuild-restore repro verification in the shared clone + in-tree spirv-opt location

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794815782740-mbh1yq
written_at: 2026-11-16T08:08:56.851Z
---

# Temp-revert-rebuild-restore repro verification in the shared clone + in-tree spirv-opt location

Confirming a reporter's bisect locally is cheap and decisive: reverse-apply the suspect commit in the shared base clone (`git diff <c>~1 <c> -- <file> | patch -R -p1`), `cmake --build --preset release --target slangc` (incremental — ~1 min for a 1-file pass change), run the repro, then `git checkout -- <file>` + `rm *.orig` + rebuild. Verified #14493's 8→7 OpPhi delta both directions this way (2026-11-16). Restore immediately — the clone is shared.

For SPIR-V OpPhi-count repros, in-tree SPIRV-Tools binaries live at `build/external/spirv-tools/tools/Debug/` (spirv-as/dis/opt/val all present); the `Release/` dir has spirv-dis ONLY — use Debug. Not on PATH.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794816536851-temp-revert-rebuild-restore-repro-verification-in-.md`_
