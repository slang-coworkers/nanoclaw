### Invocation

- Workflows are prose — follow steps inline. `/workflow-name` is NOT a runtime command.
- Gate overlays (`⟐ NAME GATE`) are mandatory at their anchor step.
- Parameters `{{name}}` are placeholders — ask when ambiguous.
- **Long-running tasks:** For builds and compilation, delegate to a subagent (`Agent`) — see scheduling instructions. For recurring/cron work, use `schedule_task`.
