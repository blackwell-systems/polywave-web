# scout-and-wave-go

Go implementation of the [Scout-and-Wave protocol](https://github.com/blackwell-systems/scout-and-wave) for parallel agent coordination.

## Protocol Compliance

Implements [SAW Protocol v0.8.0](https://github.com/blackwell-systems/scout-and-wave/tree/main/protocol):
- ✓ All 6 invariants (I1-I6)
- ✓ 7-state machine
- ✓ Worktree isolation
- ✓ YAML message formats

## Status

**Early development** - Core orchestration logic in progress.

## Installation

```bash
go install github.com/blackwell-systems/scout-and-wave-go/cmd/saw@latest
```

## Usage

```bash
# Execute wave from existing IMPL doc
saw wave --impl docs/IMPL/IMPL-add-caching.md

# Check status
saw status
```

## Architecture

```
pkg/
├── orchestrator/  # State machine, wave coordination
├── protocol/      # IMPL doc parsing, YAML schemas
├── worktree/      # Git worktree isolation
└── agent/         # LLM API client, agent execution
```

## Protocol Reference

See the [Scout-and-Wave protocol specification](https://github.com/blackwell-systems/scout-and-wave/tree/main/protocol) for:
- [participants.md](https://github.com/blackwell-systems/scout-and-wave/blob/main/protocol/participants.md) - Four participant roles
- [invariants.md](https://github.com/blackwell-systems/scout-and-wave/blob/main/protocol/invariants.md) - Six correctness guarantees
- [state-machine.md](https://github.com/blackwell-systems/scout-and-wave/blob/main/protocol/state-machine.md) - Seven states and transitions
- [message-formats.md](https://github.com/blackwell-systems/scout-and-wave/blob/main/protocol/message-formats.md) - YAML schemas

## License

MIT
