// Copyright 2020-2022 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode'
import { exec, execSync, ChildProcess } from 'child_process'
import { runInTerminal } from 'run-in-terminal'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import axios from 'axios'

const stripAnsi = require('strip-ansi')
const glob = require('glob')
const path = require('path')
const fs = require('fs')

interface Process {
  process: ChildProcess
  cmd: string
}

let outputChannel: vscode.OutputChannel
let terminal: vscode.Terminal | null = null
const runningProcesses: Map<number, Process> = new Map()

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  registerCommands(context)
  registerSchemasHandler(context)

  outputChannel = vscode.window.createOutputChannel('tauri')
  context.subscriptions.push(outputChannel)

  vscode.window.onDidCloseTerminal((closedTerminal) => {
    if (terminal === closedTerminal) {
      terminal = null
    }
  })
}

// this method is called when your extension is deactivated
export function deactivate() {
  if (terminal) {
    terminal.dispose()
  }
}

function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('tauri.init', runTauriInit),
    vscode.commands.registerCommand('tauri.dev', runTauriDev),
    vscode.commands.registerCommand('tauri.build', runTauriBuild),
    vscode.commands.registerCommand('tauri.build-debug', runTauriBuildDebug)
  )
}

function registerSchemasHandler(context: vscode.ExtensionContext) {
  vscode.workspace.registerTextDocumentContentProvider(
    'tauri',
    new (class implements vscode.TextDocumentContentProvider {
      onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>()
      onDidChange = this.onDidChangeEmitter.event

      async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        if (uri.authority === 'schemas' && uri.path === '/config.json') {
          // get schema form local file in node_modules
          const schemaFile = (
            await vscode.workspace.findFiles(
              '**/node_modules/@tauri-apps/cli/schema.json'
            )
          )[0]
          if (schemaFile) return readFileSync(schemaFile.fsPath, 'utf-8')

          async function getSchemaFromRelease(version: string) {
            const res = await axios.get(
              `https://github.com/tauri-apps/tauri/releases/download/tauri-build-v${version}/schema.json`
            )
            return res.status == 200 ? JSON.stringify(res.data) : null
          }

          // get schema form github release based on tauri-build version in Cargo.lock
          const cargoLockPath = (
            await vscode.workspace.findFiles('**/Cargo.lock')
          )[0]
          if (cargoLockPath) {
            const cargoLock = readFileSync(cargoLockPath.fsPath, 'utf-8')
            const matches =
              /\[\[package\]\]\nname = "tauri-build"\nversion = "(.*)"/g.exec(
                cargoLock
              )
            if (matches && matches[1]) {
              const schema = await getSchemaFromRelease(matches[1])
              if (schema) return schema
            }
          }

          // get schema form github release based on tauri-build version in Cargo.toml
          const cargoTomlPath = (
            await vscode.workspace.findFiles('**/Cargo.toml')
          )[0]
          if (cargoTomlPath) {
            const cargoToml = readFileSync(cargoTomlPath.fsPath, 'utf-8')

            for (const regex of [
              // specifying a dependency in Cargo.toml can be done in 4 ways
              // 1st, tauri-build = "1.0.2"
              /tauri-build *= *"(.*)"/g,
              // 2nd, tauri-build = { version = "1.0.2" }
              /tauri-build *= *{.*version = "(.*)".*}\n/g,
              // 3rd,
              // tauri-build = { features = [
              //    "f1",
              //    "f2"
              //   ], version = "1.0.2" }
              /tauri-build *= *{[\s\S.]*version = "(.*)"[\s\S.]*}\n/g,
              // 4th,
              // [dependencies.tauri-build]
              // \n version = "1.0.2"
              /\[.*tauri-build\][\s\S.]*version = "(.*)"\n/g
            ]) {
              const matches = regex.exec(cargoToml)
              if (matches && matches[1]) {
                const schema = await getSchemaFromRelease(matches[1])
                if (schema) return schema
              }
            }
          }

          // fallback to latest release
          let res = await axios.get(
            `https://api.github.com/repos/tauri-apps/tauri/releases`
          )
          let tag_name = (res.data as Array<{ tag_name: string }>).find((e) =>
            e.tag_name.startsWith('tauri-build-v')
          )?.tag_name
          if (tag_name) {
            const matches =
              /((\d|x|\*)+\.(\d|x|\*)+\.(\d|x|\*)+(-[a-zA-Z-0-9]*(.[0-9]+))*)/g.exec(
                tag_name
              )
            if (matches && matches[1]) {
              const schema = await getSchemaFromRelease(matches[1])
              if (schema) return schema
            }
          }
        }

        return ''
      }
    })()
  )
}

function runTauriInit(): void {
  __pickProjectAndRunTauriScript(
    (projectPath) => {
      let installCommand: string
      let onInstall = () => {}
      if (__isVueCliApp(projectPath)) {
        installCommand = 'vue add tauri'
      } else if (__isNodeProject(projectPath)) {
        installCommand = __usePnpm(projectPath)
          ? 'pnpm add -D @tauri-apps/cli'
          : __useYarn(projectPath)
            ? 'yarn add @tauri-apps/cli --dev'
            : `${__getNpmBin()} install @tauri-apps/cli --save-dev`
        onInstall = () => {
          const packageJson = JSON.parse(
            fs.readFileSync(`${projectPath}/package.json`)
          )
          if (!packageJson.scripts) {
            packageJson.scripts = {}
          }
          if (!packageJson.scripts['tauri']) {
            packageJson.scripts['tauri'] = 'tauri'
            fs.writeFileSync(
              `${projectPath}/package.json`,
              JSON.stringify(packageJson, null, 4)
            )
          }
          __runTauriScript(['init'], {
            cwd: projectPath,
            noOutputWindow: true
          })
        }
      } else {
        installCommand = 'cargo install tauri-cli'
      }

      const [command, ...args] = installCommand.split(' ')
      __runScript(command, args, {
        cwd: projectPath,
        noOutputWindow: command === 'vue'
      }).then(onInstall)
    },
    () => {
      const paths = __getNpmProjectsPaths()
      return paths.filter((p) => {
        return fs.existsSync(path.join(p, 'src-tauri'))
      })
    }
  )
}

function runTauriDev(): void {
  __pickProjectAndRunTauriScript((projectPath) =>
    __runTauriScript(['dev'], { cwd: projectPath })
  )
}

function runTauriBuild(): void {
  __pickProjectAndRunTauriScript((projectPath) =>
    __runTauriScript(['build'], { cwd: projectPath })
  )
}

function runTauriBuildDebug(): void {
  __pickProjectAndRunTauriScript((projectPath) =>
    __runTauriScript(['build', '--debug'], { cwd: projectPath })
  )
}

function __isVueCliApp(cwd: string): boolean {
  const packageJson = __getPackageJson(cwd)
  return '@vue/cli-service' in (packageJson?.devDependencies ?? {})
}

function __isNodeProject(cwd: string): boolean {
  return existsSync(join(cwd, 'package.json'))
}

interface PackageJson {
  dependencies: {
    [name: string]: any
  }
  devDependencies: {
    [name: string]: any
  }
}

function __getPackageJson(path: string): PackageJson | null {
  const packagePath = join(path, 'package.json')
  if (existsSync(packagePath)) {
    const packageStr = readFileSync(packagePath).toString()
    return JSON.parse(packageStr) as PackageJson
  } else {
    return null
  }
}

function __getNpmProjectsPaths(): string[] {
  const folders = vscode.workspace.workspaceFolders
  if (!folders) {
    return []
  }

  const paths = []
  for (const folder of folders) {
    const npmProjectRoots: string[] = glob
      .sync(folder.uri.fsPath.split('\\').join('/') + '/**/package.json')
      .map((p: string) => path.dirname(p))
    paths.push(...npmProjectRoots.filter((p) => !p.includes('node_modules')))
  }

  if (paths.length === 0) {
    return folders.map((f) => f.uri.fsPath)
  }

  return paths
}

function __getTauriProjectsPaths(): string[] {
  const folders = vscode.workspace.workspaceFolders
  if (!folders) {
    return []
  }

  const paths = []
  for (const folder of folders) {
    const tauriProjectRoots: string[] = glob
      .sync(folder.uri.fsPath.split('\\').join('/') + '/**/src-tauri')
      .map((p: string) => path.dirname(p))
    paths.push(...tauriProjectRoots.filter((p) => !p.includes('node_modules')))
  }
  return paths
}

function __isMultiRoot(): boolean {
  if (vscode.workspace.workspaceFolders) {
    return vscode.workspace.workspaceFolders.length > 1
  }
  return false
}

function __runCommandInTerminal(
  command: string,
  args: string[],
  cwd: string | undefined
): Promise<void> {
  return runInTerminal(command, args, { cwd, env: process.env }).then(
    (process) => {
      return new Promise((resolve, reject) => {
        process.on('exit', (code) => {
          if (code) {
            reject()
          } else {
            resolve()
          }
        })
      })
    }
  )
}

function __runCommandInIntegratedTerminal(
  command: string,
  args: string[],
  cwd: string | undefined
): Promise<void> {
  if (!terminal) {
    terminal = vscode.window.createTerminal('tauri')
  }

  terminal.show()
  if (cwd) {
    // Replace single backslash with double backslash.
    const textCwd = cwd.replace(/\\/g, '\\\\')
    terminal.sendText(['cd', `"${textCwd}"`].join(' '))
  }
  terminal.sendText(command + ' ' + args.join(' '))
  return Promise.resolve()
}

function __runCommandInOutputWindow(
  command: string,
  args: string[],
  cwd: string | undefined
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = command + ' ' + args.join(' ')
    const p = exec(cmd, { cwd, env: process.env })

    if (p.pid === undefined) {
      return reject()
    }

    runningProcesses.set(p.pid, { process: p, cmd: cmd })

    p.stderr?.on('data', (data: string) => {
      outputChannel.append(stripAnsi(data))
    })
    p.stdout?.on('data', (data: string) => {
      outputChannel.append(stripAnsi(data))
    })
    p.on('exit', (_code: number, signal: string) => {
      runningProcesses.delete(p.pid!)

      if (signal === 'SIGTERM') {
        outputChannel.appendLine('Successfully killed process')
        outputChannel.appendLine('-----------------------')
        outputChannel.appendLine('')
        reject()
      } else {
        outputChannel.appendLine('-----------------------')
        outputChannel.appendLine('')
        resolve()
      }
    })

    outputChannel.show(true)
  })
}

interface TauriProject {
  label: string
  projectPath: string
}

function __useTerminal() {
  return vscode.workspace.getConfiguration('npm')['runInTerminal']
}

function __usePnpm(projectPath: string) {
  return fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))
}

function __useYarn(projectPath: string) {
  return fs.existsSync(path.join(projectPath, 'yarn.lock'))
}

function __useNpm(projectPath: string) {
  return fs.existsSync(path.join(projectPath, 'package-lock.json'))
}

function __useCargo() {
  try {
    execSync('cargo tauri --version', { windowsHide: true })
    return true
  } catch {
    return false
  }
}

function __getNpmBin() {
  return vscode.workspace.getConfiguration('npm')['bin'] || 'npm'
}

function __getNpmCommand() {
  return __getNpmBin() + ' run'
}

function __getPackageManagerCommand(projectPath: string): string | null {
  const m = __usePnpm(projectPath)
    ? 'pnpm'
    : __useYarn(projectPath)
      ? 'yarn'
      : __useNpm(projectPath)
        ? __getNpmCommand()
        : __useCargo()
          ? 'cargo'
          : null

  if (!m) {
    vscode.window.showErrorMessage(
      "Couldn't detect package manager for current project. Try running Tauri: Init Command"
    )
  }

  return m
}

interface RunOptions {
  noOutputWindow?: boolean
  cwd: string
}

function __runScript(command: string, args: string[], options: RunOptions) {
  vscode.window.showInformationMessage(
    `Running \`${command} ${args.join(' ')}\` in ${options.cwd}`
  )

  return vscode.workspace.saveAll().then(() => {
    if (__useTerminal() || options.noOutputWindow) {
      if (typeof vscode.window.createTerminal === 'function') {
        return __runCommandInIntegratedTerminal(command, args, options.cwd)
      } else {
        return __runCommandInTerminal(command, args, options.cwd)
      }
    } else {
      outputChannel.clear()
      return __runCommandInOutputWindow(command, args, options.cwd)
    }
  })
}

function __runTauriScript(args: string[], options: RunOptions): void {
  const command = __getPackageManagerCommand(options.cwd)
  if (!command) return

  if (__isVueCliApp(options.cwd)) {
    const [cmd, ...cmgArgs] = args
    __runScript(
      command,
      [`tauri:${cmd === 'dev' ? 'serve' : cmd}`, ...cmgArgs],
      options
    )
  } else {
    __runScript(command, ['tauri', ...args], options)
  }
}

function __pickProjectAndRunTauriScript(
  runner: (projectPath: string) => void,
  getProjectPathsFn = __getTauriProjectsPaths
): void {
  const tauriProjectsPaths = getProjectPathsFn()
  const projectList: TauriProject[] = []

  for (const p of tauriProjectsPaths) {
    let label = path.basename(p)
    if (__isMultiRoot()) {
      const root = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p))
      if (root && root.name !== label) {
        label = `${root.name}: ${label}`
      }
    }

    projectList.push({
      label,
      projectPath: p
    })
  }

  if (projectList.length === 0) {
    vscode.window.showErrorMessage('Tauri project not found')
    return
  }

  if (projectList.length === 1) {
    runner(projectList[0].projectPath)
  } else {
    vscode.window.showQuickPick(projectList).then((project) => {
      if (project) {
        runner(project.projectPath)
      }
    })
  }
}
