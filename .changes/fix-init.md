---
'tauri-vscode': patch
---

Fix `Tauri: Init` command. That command tried to detect workspaces with a `src-tauri` directory, which does not exist yet when `Init` is used.

