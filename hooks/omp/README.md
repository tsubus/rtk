# Oh My Pi Hooks

> Part of [`hooks/`](../README.md) — see also [`src/hooks/`](../../src/hooks/README.md) for installation code

## Specifics

- TypeScript extension module, not a shell hook or rules file
- Sets its OMP extension display label to `RTK`
- Installs to `./.omp/extensions/rtk.ts` with `rtk init --agent omp`, or to `~/.omp/agent/extensions/rtk.ts` with `rtk init -g --agent omp`
- Intercepts OMP `tool_call` events for the `bash` tool and delegates rewrite decisions to `rtk rewrite`
- Fail-open: if `rtk` is unavailable or `rtk rewrite` fails, commands run raw unchanged
- Multi-extension chaining: OMP dispatches `tool_call` handlers sequentially. Downstream handlers observe the RTK-rewritten `event.input.command` when RTK rewrites it
