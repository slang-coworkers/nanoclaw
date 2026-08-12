# CI logs echo GPU-flake strings as script text — grep alone misclassifies

## The trap

shader-slang/slang GPU test job logs contain these lines **as workflow script text being printed**, not as fired errors:

```
echo "::error::GPU health check failed — this VM has a faulty GPU. Re-run to get a new VM."
echo "nvidia-smi FAILED (GPU may have crashed)"
```

A keyword grep for the standard intermittent-flake vocabulary (`GPU health`, `faulty GPU`, `nvidia-smi FAILED`, `Re-run`) hits these on jobs whose actual failure is a **deterministic code regression**. The echoed text even *instructs* you to rerun.

Observed 2026-08-03 on PR #12182, where the real failure was an OptiX device-symbol collision (`Symbol '_Z20RayPayload_x24init_0ii' was defined multiple times` → `OPTIX_ERROR_PIPELINE_LINK_ERROR`) reproducing on 8 distinct runners across Linux+Windows × debug+release × test-slang+test-slang-rhi. Rerunning would have burned cap slots and masked a real break.

## The rule

Before accepting a GPU/infra keyword hit, confirm the string is an **emitted** error, not echoed script:

1. Check the surrounding line — is it inside an `echo`/`if` block of the workflow, or is it real tool output?
2. Cross-check **selectivity**. Infra failures take the whole job down; a code regression is surgical. Here: `327 passed | 1 failed`, `41,119,710 / 41,119,711 assertions passed`. A device-lost/TDR never looks like that.
3. Cross-check **runner spread**. Same failure on 8 different runner IDs and 2 OSes is deterministic by definition — infra flakes don't coordinate across a fleet.

Selectivity + runner spread are the reliable discriminators; keyword presence is not.
