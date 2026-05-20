<div align="center">

# 🔍 Model Checker

**Know if your AI endpoints actually work — before your code hits them.**

A native macOS app that tests OpenAI-compatible API connections for real chat completion capability, not just HTTP reachability.

[![Release](https://img.shields.io/github/v/release/Fei2-Labs/model-checker?style=flat-square)](https://github.com/Fei2-Labs/model-checker/releases)
[![License](https://img.shields.io/github/license/Fei2-Labs/model-checker?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/Fei2-Labs/model-checker?style=flat-square)](https://github.com/Fei2-Labs/model-checker/stargazers)

</div>

---

## The Problem

You add an API endpoint. The server responds. Models show up. You think it works.

Then your app breaks because the model can't actually complete a chat request.

**Model Checker catches this before you ship.**

## What It Does

| Feature | Description |
|---------|-------------|
| 🔌 **Saved Connections** | Persist endpoints across restarts. API keys live in your OS keychain — never in config files. |
| 📦 **Model Inventory** | Discover all models exposed by a connection via `/models`. See what got added or removed. |
| ⚡ **Availability Test** | Send a real chat completion request. If it fails, you know immediately — with the exact curl command to reproduce. |
| 🎯 **Smart Status** | `Available` · `Partially Compatible` · `Needs Test Model` · `Refresh Failed` · `Unavailable` · `Untested` |
| 🧠 **Thinking Model Support** | Works with Qwen3, DeepSeek-R1, and other reasoning models that use `reasoning_content`. |
| 🌙 **Dark Mode** | Follows macOS system appearance automatically. |

## Quick Start

**Download the latest release:**

👉 [**Model Checker.dmg**](https://github.com/Fei2-Labs/model-checker/releases/latest) (macOS Apple Silicon)

Or build from source:

```bash
# Prerequisites: Node 20, pnpm, Rust toolchain
pnpm install
pnpm tauri dev      # development
pnpm tauri build    # release .app + .dmg
```

## How It Works

A two-panel layout: **sidebar** lists your saved connections, **detail pane** shows status, models, latency, and test results.

When a test runs, you see the equivalent `curl` command — copy it straight into your terminal to debug.

```bash
curl -X POST "https://api.example.com/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Reply with the single word OK."}],"max_tokens":5,"temperature":0}'
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Shell | [Tauri 2](https://tauri.app) |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS |
| Secrets | OS Keychain via [`keyring`](https://crates.io/crates/keyring) |
| HTTP | [`reqwest`](https://crates.io/crates/reqwest) |

## Project Structure

```
src/                  React frontend
  components/         UI components (sidebar, detail pane, forms)
  lib/                Tauri API bindings
src-tauri/
  src/
    commands.rs       Tauri command handlers
    availability.rs   Chat completion probe
    discovery.rs      Model inventory via /models
    secrets.rs        OS keychain wrapper
    storage.rs        JSON persistence
```

## Contributing

Issues and PRs welcome. This is an early-stage tool — feedback on UX, edge cases with specific providers, and thinking-model compatibility is especially useful.

## License

[MIT](LICENSE)

---

<div align="center">

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Fei2-Labs/model-checker&type=Date)](https://star-history.com/#Fei2-Labs/model-checker&Date)

</div>
