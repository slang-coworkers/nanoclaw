---
type: incident
title: slangpy#1250 — pyright/nodeenv CI break from nodejs v27.0.0-alpha index entry
description: From ~10-29 22:15Z every slangpy ci-latest-slang run fails in the pyright step (nodeenv ValueError '0-alpha'). nodejs.org index.json[0] is v27.0.0-alpha.0.0.0. That turns SlangPy Tests red on every Slang PR. Filed by the babysitter; on 10-30 00:1xZ Main dispatched slangpy-fixer for a draft pin PR.
tags: [slangpy, ci, infra, cross-repo, incident]
---

# slangpy#1250: nodeenv vs the Node 27 alpha index entry

- **Filed** by slang-ci-babysitter at 10-30 00:02Z: https://github.com/shader-slang/slangpy/issues/1250. **This chain owns it, so an `issue_opened` webhook for #1250 needs no new dispatch.**
- **Symptom:** the `pyright` step dies in `nodeenv` with `ValueError ... '0-alpha'`. 11 of 11 `ci-latest-slang` runs failed since 22:13Z; the last green was 40958330791 at 21:30Z. I verified live that runs from 22:53Z to 23:35Z failed and that `index.json[0]` = `v27.0.0-alpha.0.0.0` (2026-10-29). The causal link is the babysitter's inference.
- **Impact:** the required `SlangPy Tests` status is red on every Slang PR (8 named: #13848, #13855, #13885, #13918, #14045, #14052, #14065, #14068). Reruns can't help.
- **10-30 00:1xZ:** dispatched slangpy-fixer on `gh-issue-shader-slang/slangpy-1250` to open a minimal **draft** PR that pins Node for pyright. If the token can't push workflow files, it reports the error. Reported to the operator.
- **Root cause (fixer, reproduced):** self-hosted runners keep a persistent toolcache Python, so pip leaves the cached nodeenv 1.10.0 in place (pulled in by pre-commit, unpinned). nodeenv 1.10.0 with `--node latest` takes `index.json[0]` and hits `int('0-alpha')`. nodeenv 1.11.1 (PyPI, 10-29 20:54Z) skips prereleases.
- **Fix PR slangpy#1251** (`fix/issue-1250`, bot, draft): it adds only `nodeenv>=1.11.1` to requirements-dev.txt. CI on its head is all green (ci and checks both success). The description names the alternative, `PYRIGHT_PYTHON_NODE_VERSION=26.13.0`, and notes that 1.11.1 is less than a day old. At 10-30 02:1xZ I asked the fixer to mark it ready, with no reviewer requests.
- **After merge:** the babysitter does one `--failed` SlangPy rerun per affected Slang PR once the newest `ci-latest-slang` run is green.
