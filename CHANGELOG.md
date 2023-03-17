# Changelog

## \[0.2.6]

- Revert multiple deps update.
  - [731a586](https://www.github.com/tauri-apps/tauri-vscode/commit/731a586be20a9216cdef2474e83f4071cef0b0ed) revet: revert multiple deps update on 2023-03-17

## \[0.2.2]

- use stripAnsi to remove ansi colors in output
  - [2a0af16](https://www.github.com/tauri-apps/tauri-vscode/commit/2a0af165bf83e9001ceb3154706b89cff8605960) fix: use stripAnsi to remove ansi colors in output ([#196](https://www.github.com/tauri-apps/tauri-vscode/pull/196)) on 2023-02-06

## \[0.2.1]

- Add support for `cargo` as a package manager.
  - [c78393c](https://www.github.com/tauri-apps/tauri-vscode/commit/c78393cdec2911abcbd87a45f3cbc0311f9f5a1c) feat: support cargo as a package manager, closes [#187](https://www.github.com/tauri-apps/tauri-vscode/pull/187) ([#189](https://www.github.com/tauri-apps/tauri-vscode/pull/189)) on 2022-10-22

## \[0.2.0]

- Provide schema for `tauri.conf.json` based on `tauri-build` version.
  - [f85fc5c](https://www.github.com/tauri-apps/tauri-vscode/commit/f85fc5c17400f4f43dee9b04e71510a0aed4e8f4) feat: provide schema for config based on tauri-build version ([#162](https://www.github.com/tauri-apps/tauri-vscode/pull/162)) on 2022-09-19

## \[0.1.7]

- Fix dependency resolution and glob usage. Fixes "command not found" errors.
  - [0e314cc](https://www.github.com/tauri-apps/tauri-vscode/commit/0e314cc2581adca626b5f804ef981ede427bfb48) fix: Manual brace-expansion resolution. Fix glob usage for glob@v8. Closes [#163](https://www.github.com/tauri-apps/tauri-vscode/pull/163) ([#169](https://www.github.com/tauri-apps/tauri-vscode/pull/169)) on 2022-09-11

## \[0.1.6]

- Update schema fileMateches to detect `.json5`
  - [a4e5721](https://www.github.com/tauri-apps/tauri-vscode/commit/a4e5721ef4212ba7c4bc4f7aa99bc8c8820b8d40) feat: detect schema on `.json5` conf on 2022-06-18

## \[0.1.5]

- Update the extension icon.
  - [f681c06](https://www.github.com/tauri-apps/tauri-vscode/commit/f681c0648dc8b830a38cd6cf33527bd11c825ebf) Update tauri icon ([#153](https://www.github.com/tauri-apps/tauri-vscode/pull/153)) on 2022-06-19

## \[0.1.4]

- Added support for pnpm.
  - [6b10c02](https://www.github.com/tauri-apps/tauri-vscode/commit/6b10c02c84566ad9e34a4549059471238c105951) split changefiles on 2022-01-13
- Automatically add `"tauri"` script to package.json after installing `@tauri-apps/cli`.
  - [6b10c02](https://www.github.com/tauri-apps/tauri-vscode/commit/6b10c02c84566ad9e34a4549059471238c105951) split changefiles on 2022-01-13
- Added support for platform-specific config files.
  - [223ac46](https://www.github.com/tauri-apps/tauri-vscode/commit/223ac4611f5f52920b693de7ca0895ee654aad3d) added change file on 2022-01-13

## \[0.1.3]

- Added Tauri command and covector snippets.
  - [f610ceb](https://www.github.com/tauri-apps/tauri-vscode/commit/f610cebcd527460f391d1bd7059d5c26f334baf7) feat: covector snippets on 2021-09-29

## \[0.1.2]

- Adds `deps install` and `deps update` commands.
  - [c75323c](https://www.github.com/tauri-apps/tauri-vscode/commit/c75323c24a8b219a8d88b6170c9c79ec3e0a5588) feat: add `deps` commands on 2021-05-04

## \[0.1.1]

- Fixes the `tauri.conf.json` schema URL.
  - [1d1d005](https://www.github.com/tauri-apps/tauri-vscode/commit/1d1d0054b4364f1ea2ff9a18ae04eb75a234cd19) fix: schema URL on 2021-04-29

## \[0.1.0]

- Update to tauri beta-rc.
  - [27cf9a6](https://www.github.com/tauri-apps/tauri-vscode/commit/27cf9a602acc700a5f8d19e1b9f873b071b7ada7) add change file on 2021-04-23

## \[0.0.3]

- Add covector for changelog management.
  - [0a0811a](https://www.github.com/tauri-apps/tauri-vscode/commit/0a0811a3aa1ddcb3ba60fb155576ca216527be34) feat(workflow) add test, covector on 2020-07-14
- Add vue-cli-plugin-tauri support, [original commit](https://github.com/tauri-apps/tauri-vscode/commit/3d306557dab470ed167ed0d6e5b1237e8d22cdc4).
  - [929075a](https://www.github.com/tauri-apps/tauri-vscode/commit/929075aae15492e2211738a3f54b47c9050558fe) chore(changes) add vue cli plugin change on 2020-07-14
