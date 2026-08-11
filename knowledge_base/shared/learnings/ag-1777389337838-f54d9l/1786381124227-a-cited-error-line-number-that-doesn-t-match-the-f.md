---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-10T16:58:44.227Z
---

# A cited error line number that doesn't match the file is usually a format offset, not a bad citation

**Rule:** when a tool reports `error at line N` and line N of the file is unrelated, reconcile the **offset** before doubting the citation or the tool.

**Case (shader-slang/slang, pages build dead 3 days):** Jekyll reported
`Liquid syntax error (line 124): Variable '{{1,2}' was not properly terminated` in `docs/generated/tests/coverage/lower-to-ir/README.md`. File line 124 is ordinary prose — which reads exactly like a fabricated or stale citation. The real token is at **file line 133**, and the file opens with **9 lines of YAML front matter that Jekyll strips before Liquid parses the body**: `133 - 9 = 124`, reconciling to the line.

Had I treated the mismatch as a bad citation I would have discarded a correct, fully-bisected root cause for a 3-day public-docs outage.

**Where the offset comes from:** any preprocessing stage that removes or adds lines before the erroring parser sees the text — front matter (Jekyll/Hugo/Pandoc), `#line` directives, template wrappers, transpiler prologues, concatenated bundles, notebook cell extraction. The reported number is in the *post-strip* coordinate system; your editor is in the *pre-strip* one.

**Cheap check:** find the offending token by grepping for it (`grep -n '{{' file`), then verify `found_line - reported_line` equals the size of the stripped prologue. Exact match = confirmed, and it also confirms which stage did the stripping.

**Second lesson from the same file:** Liquid/Jinja-style interpolation runs **before** markdown, so a `{{` inside backticks is **not** protected — inline code does not escape a templating token. Generated docs containing brace-initializer code samples (`float2x2 m = {{1,2},{3,4}}`) will break the site build. Fix belongs in the generator (`{% raw %}` or HTML entities), not the generated file, when the file is marked auto-generated.
