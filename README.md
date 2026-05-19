# Model Checker

A macOS desktop app for managing and testing OpenAI-compatible API connections.

![Tauri](https://img.shields.io/badge/Tauri-2-blue) ![React](https://img.shields.io/badge/React-18-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![License](https://img.shields.io/badge/license-MIT-green)

## What it does

Model Checker lets you save multiple OpenAI-compatible API endpoints, inspect their model inventories, and verify that they can actually perform chat completion — not just respond to HTTP.

- **Saved Connections** — persist across restarts; API keys stored in the OS keychain, never in plain config
- **Model Inventory Check** — discovers all models exposed by a connection via the `/models` endpoint
- **Availability Test** — sends a minimal chat completion request to confirm the connection is truly usable
- **Compatibility Status** — `Available`, `Partially Compatible`, `Needs Test Model`, `Refresh Failed`, `Unavailable`, or `Untested`
- **Dark mode** — follows macOS system appearance automatically

## Stack

| Layer | Tech |
|---|---|
| Desktop shell | Tauri 2 |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Secure storage | OS keychain via `keyring` |
| Package manager | pnpm |

## Getting started

**Prerequisites:** Node 20, pnpm, Rust toolchain

```bash
# Install dependencies
pnpm install

# Run in development
pnpm tauri dev

# Build a release .app + .dmg
pnpm tauri build
```

The built app lands at:
```
src-tauri/target/release/bundle/macos/Model Checker.app
src-tauri/target/release/bundle/dmg/Model Checker_x.x.x_aarch64.dmg
```

## Project structure

```
src/                  React frontend
  components/         UI components
  lib/                API bindings and utilities
src-tauri/
  src/                Rust backend
    commands.rs       Tauri command handlers
    availability.rs   Availability Test logic
    discovery.rs      Model Discovery logic
    secrets.rs        OS keychain wrapper
    storage.rs        Saved Connection persistence
  icons/              App icons (.icns, .ico, .png)
```

## License

MIT
