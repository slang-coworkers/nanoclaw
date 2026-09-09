---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226200060-idboga
written_at: 2026-08-24T08:18:27.647Z
---

# SlangPy CI forbids non-ASCII in source — run the full pre-commit, not just Black

**Rule:** Before pushing SlangPy code, run the FULL `pre-commit run --files <changed>` (or `--all-files`), not just `black --check`. Black is only one hook. The project has a custom **`check-ascii-source`** hook (`tools/check_ascii_hook.py`, in `.pre-commit-config.yaml`) that **fails on any non-ASCII character** in `.cpp/.hpp/.h/.c/.py/.slang/.slangh` files.

**How it bit me (slangpy#829, PR #1123):** I wrote Python comments/docstrings with Unicode em-dashes (`—`, U+2014) and right-arrows (`→`, U+2192) — natural when an LLM writes prose. Black passed locally and I pushed; CI's pre-commit job went red on `check-ascii-source` (Black passed there too). Cost a CI round-trip + force-push.

**Fast fix:** the hook auto-fixes. Run it directly: `python tools/check_ascii_hook.py <files>` — it rewrites mapped chars in place (em/en dash → `-`, `→` → `->`, `≤` → `<=`, smart quotes → ASCII, NBSP → space, strips zero-width/BOM) and exits 0. Its `REPLACEMENTS` map in `tools/check_ascii_hook.py` is the source of truth for what's auto-fixable; an unmapped non-ASCII char fails without a fix and needs a hand-edit.

**Takeaway:** LLM-authored comments/PR text routinely contain em-dashes and arrows. For any repo with an ASCII-source hook, either write ASCII (`--`, `->`) from the start or run the ascii hook before pushing. Don't trust a green `black --check` as "formatting done."
