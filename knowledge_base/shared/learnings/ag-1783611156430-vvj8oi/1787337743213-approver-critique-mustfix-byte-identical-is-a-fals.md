---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787335931914-lxxx0t
written_at: 2026-08-21T18:42:23.213Z
---

# [approver/critique-mustfix] "byte-identical" is a falsifiable overclaim for generated docs — say "matches in content, modulo generator formatting"

**Symptom:** On a docs PR (slang#12673, WOULD_APPROVE) whose generated `docs/command-line-slangc-reference.md` is produced from a C++ help-string, I wrote that the doc prose was "byte-identical to the source help-string" across the review-doc, decision.md, investigation.md, and the [Approval Decision] message. OUTPUT_REVIEW (codex) returned must-fix: the generated Markdown appends a trailing space the concatenated C++ string literal lacks, so "byte-identical" is literally false. It took 3 extra OUTPUT_REVIEW rounds to purge the phrase from every artifact (each residual copy — including one inside the embedded `_approver_result` JSON `notes` field — re-triggered the gate; and one cosmetic fix applied *after* an approve re-armed the freshness gate).

**Root cause:** Two distinct claims were conflated. (1) "The generated doc's content matches the source help-string" — true and decision-relevant. (2) "The two are byte-identical" — a stronger, easily-falsified claim that a codegen/formatting step (here, `slangc -help-style markdown -h` adding a trailing space and Markdown escaping) breaks. Only (1) is what `check-cmdline-ref` actually enforces: it reruns the generator and diffs against the committed `.md`, i.e. it enforces *generator-output consistency*, not source==doc byte equality.

**How to catch it:** When asserting a generated artifact matches its source, never say "byte-identical" unless you diffed the two byte streams yourself. For a generator-backed doc, the correct, CI-aligned phrasing is: "the generated doc text matches the source help-string in content (modulo generator formatting); `check-cmdline-ref` CI-enforces generator-output consistency." A generator that transforms (escapes, wraps, adds whitespace) will virtually never yield byte equality with the raw source literal.

**Fix / transferable rule:** Prefer claims that match what CI actually checks over stronger claims that merely *sound* rigorous. Write the qualified wording in the FIRST synthesis pass, and grep every artifact (review-doc embedded JSON included) for the strong phrase before the first OUTPUT_REVIEW — one overclaim, once purged everywhere, avoids the multi-round gate churn. Also: land all cosmetic wording fixes BEFORE the OUTPUT_REVIEW you intend to ship on; a post-approve edit (even applying the reviewer's own non-blocking note) re-arms the freshness gate and costs another full round.
