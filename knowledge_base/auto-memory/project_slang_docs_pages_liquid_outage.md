---
name: project_slang_docs_pages_liquid_outage
description: "slang docs site dead since 2026-08-07T13:39:40Z: LLM-generated docs/generated/tests/coverage/lower-to-ir/README.md:133 has `{{1,2}` which Liquid cannot terminate. Generator fix. Only 3 of 21 {{-bearing .md files are Jekyll-processed and only UNBALANCED ones break — FileCheck {{.*}} is safe."
metadata:
  node_type: memory
  type: project
---

# slang docs site down 3 days — an LLM-generated doc broke Jekyll/Liquid

## ✅⭐⭐⭐ 2026-08-10 — DIAGNOSIS VERIFIED IN FULL, AND I FOUND THE PART THAT MAKES THE GENERATOR FIX PRECISE

`slang-discord-support` reported the outage with a complete causal chain. **Every element verified on my edge:**
```
docs/generated/tests/coverage/lower-to-ir/README.md
  front matter: lines 1-8 (closing --- at line 8) => Jekyll strips 9 lines
  :133  "with `float2x2 m = {{1,2},{3,4}}`, `float3 v = {1,2,3}`, `P p = {3,4}`,"
  133 - 9 = 124  == the reported "Liquid syntax error (line 124)"          ✅
  front matter also carries:  generated: true   model: claude-opus-5[1m]
                              warning: "Auto-generated. May drift from source. Do not edit by hand."
```
⇒ ✅ **An LLM-generated doc took down the public docs site, and the file says "do not edit by hand" ⇒ the fix belongs in the GENERATOR, exactly as they said.** ⭐⭐ **And their `backticks do not protect `{{`` point is the load-bearing one: Liquid runs BEFORE markdown, so a fenced/inline-code `{{` is still parsed as a Liquid variable.** That is the non-obvious fact a generator author would get wrong.

## ⛔⭐⭐⭐ BUT "escape `{{` in the generator" AS STATED IS BOTH TOO BROAD AND TOO NARROW — measured

```
files under docs/generated/ containing '{{'            = 1135   <- mostly .slang, NOT Liquid-processed
  narrowed to *.md                                     =   21
  narrowed to *.md WITH Jekyll front matter (processed) =    3
       docs/generated/tests/coverage/lower-to-ir/README.md            <- the broken one
       docs/generated/tests/design/target-pipelines/metal/README.md
       docs/generated/tests/design/pipeline/04-ast-to-ir/README.md
```
⇒ ⭐⭐ **TOO NARROW: fixing only the reported file leaves TWO other processed files carrying `{{`.** ⇒ ⭐⭐ **TOO BROAD: those two are SAFE, and the reason is the real discriminator —**
```
broken : {{1,2},{3,4}}   -> Liquid's token is  "{{1,2}"   closes with a SINGLE }  => never terminates => ERROR
safe   : {{[0-9]+}}      -> closes with a real }}  => parses as a (nonsense) variable, no error
safe   : {{.*}}          -> same
```
⇒ ⭐⭐⭐ **THE PREDICATE IS NOT "contains `{{`" — IT IS "contains a `{{` not terminated by `}}`".** FileCheck wildcards (`{{.*}}`, `{{[0-9]+}}`) are *balanced* and therefore harmless, and they are pervasive in this corpus. **A generator that escaped every `{{` would rewrite hundreds of legitimate FileCheck patterns; one that escaped only the reported string would leave the class open.** ⚠️ **My own first test was wrong here and I caught it: counting `opens`/`closes` per line reported all three as "terminated", because the broken line DOES contain `}}` later (from `{3,4}}`). The correct test is whether the FIRST `{{` is followed by `}}` before any other `{`-token — i.e. parse it, don't count it.** ⇒ **A balance count is not a parse.**

⇒ ✅ **ROUTING POSITION for the operator:** (1) generator escapes `{{` **only when unterminated** (or emits `{% raw %}` around such spans); (2) the pre-deploy gate they ask for is right and cheap — **nothing currently runs a Jekyll build before deploy**, so this class ships to production every time; (3) the two sibling files need no change, which is worth saying so nobody "fixes" the FileCheck wildcards.

✅ **Their instrument caveats, both good:** bisected to `3241dfa861` as *the only commit ever to touch that file*, and prior-art search `Liquid` total=0 ⇒ genuinely unfiled. **5 consecutive `pages build and deployment` failures, signature byte-identical across 3 runs they log-checked, zero `github-pages` deploys in 3 days.**

⚠️ **Their self-caught near-miss is one my store already carries and they corrected the EXISTING leaf rather than duplicating: `/rate_limit` reports `X-Ratelimit-Limit: 60` while `/repos/...` reads 6000 on the same connection — the gateway injects PER-PATH.** The tell was `used: 0` after ~10 successful calls. ⭐ **"I re-derived a fact already in my store" is the correct thing to report, and updating in place is the correct remedy.**
