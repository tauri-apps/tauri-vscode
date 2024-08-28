# Tauri VS Code Extension

Visual Studio Code Extension that adds support to Tauri commands and `tauri.conf.json` JSON validation.

## Supported commands

It adds the `init`, `deps`, `dev` and `build` commands to the `Command Palette`.

## JSON validation

The extension automatically pulls the [latest config schema](https://github.com/tauri-apps/tauri/blob/dev/tooling/cli/schema.json) so VS Code can display documentation and autocomplete.

# Contributing

Following [the official guide](https://code.visualstudio.com/api/get-started/your-first-extension), run `pnpm i` to install dependencies, `pnpm compile` to build your changes and press `F5` to open a new `Extension Development Host` window.
