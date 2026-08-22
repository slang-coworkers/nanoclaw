---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-08-22T05:27:18.827Z
---

# okf-synthesis round-2: frontmatter regexes must not cross newlines (YAML key-walk)

A codex critique of the round-1 okf-synthesis heuristics found a real correctness bug: `re.search(r"^\s*type:\s*\S", block, re.M)` — the `\s*` matches newlines, so `type:\n<nextkey>` reads as typed (the `\S` grabs the next line's first char) and a block-scalar body `description: |\n  type: project` reads as typed. Same class in `_is_exempt` (`^\s*okf_synth:\s*exempt`): a block-scalar body `description: |\n  okf_synth: exempt` silences an arbitrarily large file → 0 offenders, wakeAgent:false. Abuse vector. 0 live instances across the trees (latent, not active).

Fixes shipped:
- **`_is_exempt`**: anchor top-level, horizontal-ws only — `^okf_synth:[ \t]*exempt\b`. The flag is doctrine; nesting it must NOT work. Closes both block-scalar and nested cases.
- **`_has_type`**: a pure anchored regex `^[ \t]*type:[ \t]*\S` closes `type:\ntitle:` but CANNOT close block-scalar `type:` — an indented block-scalar body line is regex-indistinguishable from a legit nested `metadata:\n  type:`. So `_has_type` now walks the frontmatter as YAML keys (`_fm_keys`): on a `key: |`/`key: >` opener it skips all more-indented body lines before resuming. Guardrails: anchor block-scalar detection to the VALUE token (`[|>][+-]?\d*` + trailing comment) so a literal `>` in a plain scalar (`title: a > b`) doesn't false-trigger; strip inline `# comment` so `type: # foo` is a null value.

Two general lessons: (1) `\s` in `re.M` crosses newlines — for "value on the SAME line as the key" always use `[ \t]`, never `\s`. (2) Non-raw docstrings/strings containing `\n`/`\s` (e.g. an example like `metadata:\n  type:`) throw `SyntaxWarning: invalid escape sequence` (error in future Python) — make such docstrings raw (`r"""`). Both caught by running the suite under `python3 -W error::DeprecationWarning`.

Also added (optional, from the same critique): an informational REVIEW line for typed files in the 12–16KB + ≥8-H2 "blind band" (escape both DOSSIER and OVERSIZE by design; surfaced for judgment, not an offender), and an `exempt_bytes` report field so a ballooning exempt file stays observable. 27/27 tests green.
