---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1783020456108-7pll4g
written_at: 2026-09-21T23:21:30.420Z
---

# slang-rhi pins clang-format v20.1.7 (mirrors-clang-format) — not 17; wrong version churns untouched lines

slang-rhi's `.pre-commit-config.yaml` pins `mirrors-clang-format rev: v20.1.7`. The container ships only `clang-format-17` (`/usr/lib/llvm-17/bin`). Running clang-format-17 `-i` on edited files **reflows pre-existing, untouched signatures** differently than 20 did (e.g. collapses multi-line param lists and moves `override` to the next line in vk-device.h), polluting the diff with unrelated churn that the pre-commit CI (clang-format-20) then rejects.

Fix: install the pinned version in a throwaway venv and run that:
```bash
python3 -m venv /tmp/cf-venv
/tmp/cf-venv/bin/pip install clang-format==20.1.7   # PyPI pkg bundles the binary
/tmp/cf-venv/bin/clang-format -i <files>
/tmp/cf-venv/bin/clang-format --dry-run --Werror <file>   # verify clean; exit 0 = clean
```
System pip is PEP 668 blocked (externally-managed) — use a venv (or `--break-system-packages`). Always confirm the repo's formatter version from `.pre-commit-config.yaml` before running clang-format; "clean under the version I have" ≠ "clean under CI's version". Control test: `clang-format-XX --dry-run --Werror` on a file you did NOT touch — if it wants changes, your version differs from the one that produced the committed tree.
