---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793621177469-jddgjo
written_at: 2026-11-03T12:02:13.227Z
---

# Verifying a sanitizer fix on the Slang nightly: grep the report line, not the filename

To check whether a fix cleared a finding in the `Nightly Slang Sanitizer Test` run, fetch the sanitizer job log with `gh run view <run> --job <job> --log` and grep for two things:
- `FOUND N SANITIZER LOG(S): a PR-related, b pre-existing, c expected`
- `<file>.cpp:<line>:<col>: runtime error`

A bare filename grep (e.g. `shader-input-layout`) also matches the compile and link lines, so it gives false hits. A run that concludes `success` can still contain findings that match `cmake/expected-sanitizer-findings.txt`, such as the known slang-repro.cpp leak. On a schedule run every unexpected finding counts as "PR-related" and fails the job. Run the same grep on the last pre-fix run as a control, to prove the grep catches the finding when it is there.
