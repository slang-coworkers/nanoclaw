### Invocation

- Workflows are prose — follow steps inline. `/workflow-name` is NOT a runtime command.
- Gate overlays (`⟐ NAME GATE`) are mandatory at their anchor step.
- Parameters `{{name}}` are placeholders — ask when ambiguous.
- **Long-running tasks (> 5 min):** Before starting a build, CI run, or any work that takes more than ~5 minutes, you MUST schedule a watchdog via `schedule_task` with `new_session=false` and notify parent. The container's idle timer will kill the stream otherwise and the outcome is lost. See `/base-nanoclaw` § scheduling for the full 3-step pattern.
