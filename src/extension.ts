import * as vscode from 'vscode';
import { exec, ChildProcess } from 'child_process';
import { runInTerminal } from 'run-in-terminal';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
const glob = require('glob');
const path = require('path');
const fs = require('fs');

interface Process {
  process: ChildProcess;
  cmd: string;
}

let outputChannel: vscode.OutputChannel;
let terminal: vscode.Terminal | null = null;
const runningProcesses: Map<number, Process> = new Map();

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  registerCommands(context);

  outputChannel = vscode.window.createOutputChannel('tauri');
  context.subscriptions.push(outputChannel);

  vscode.window.onDidCloseTerminal(closedTerminal => {
    if (terminal === closedTerminal) {
      terminal = null;
    }
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
  if (terminal) {
    terminal.dispose();
  }
}

function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('tauri.init', runTauriInit),
    vscode.commands.registerCommand('tauri.deps-install', runTauriDepsInstall),
    vscode.commands.registerCommand('tauri.deps-update', runTauriDepsUpdate),
    vscode.commands.registerCommand('tauri.dev', runTauriDev),
    vscode.commands.registerCommand('tauri.build', runTauriBuild),
    vscode.commands.registerCommand('tauri.build-debug', runTauriBuildDebug)
  );
}

function runTauriInit(): void {
  __pickProjectAndRunTauriScript(projectPath => {
    let installCommand: string;
    let onInstall = () => { };
    if (__isVueCliApp(projectPath)) {
      installCommand = 'vue add tauri';
    } else {
      installCommand = __usePnpm(projectPath)
        ? 'pnpm add -D @tauri-apps/cli'
        : __useYarn(projectPath)
        ? 'yarn add @tauri-apps/cli --dev'
        : `${__getNpmBin()} install @tauri-apps/cli --save-dev`;
      onInstall = () => {
        __runTauriScript(['init'], { cwd: projectPath, noOutputWindow: true });
      };
    }

    const [command, ...args] = (installCommand).split(' ');
    __runScript(command, args, { cwd: projectPath, noOutputWindow: command === 'vue' }).then(onInstall);
  }, () => {
    const paths = __getNpmProjectsPaths();
    return paths.filter(p => {
      return !fs.existsSync(path.join(p, 'src-tauri'));
    });
  });
}

function runTauriDepsInstall(): void {
  const projectPaths = __getTauriProjectsPaths();
  if (projectPaths.length === 0) {
    vscode.window.showErrorMessage('Tauri project not found');
    return;
  }
  __runTauriScript(['deps', 'install'], { cwd: projectPaths[0] });
}

function runTauriDepsUpdate(): void {
  const projectPaths = __getTauriProjectsPaths();
  if (projectPaths.length === 0) {
    vscode.window.showErrorMessage('Tauri project not found');
    return;
  }
  __runTauriScript(['deps', 'update'], { cwd: projectPaths[0] });
}

function runTauriDev(): void {
  __pickProjectAndRunTauriScript(projectPath => __runTauriScript(['dev'], { cwd: projectPath }));
}

function runTauriBuild(): void {
  __pickProjectAndRunTauriScript(projectPath => __runTauriScript(['build'], { cwd: projectPath }));
}

function runTauriBuildDebug(): void {
  __pickProjectAndRunTauriScript(projectPath => __runTauriScript(['build', '--debug'], { cwd: projectPath }));
}

function __isVueCliApp(cwd: string): boolean {
  const packageJson = __getPackageJson(cwd);
  return '@vue/cli-service' in (packageJson?.devDependencies ?? {});
}

interface PackageJson {
  devDependencies: {
    [name: string]: any
  }
}

function __getPackageJson(cwd: string): PackageJson | null {
  const packagePath = join(cwd, 'package.json');
  if (existsSync(packagePath)) {
    const packageStr = readFileSync(packagePath).toString();
    return JSON.parse(packageStr) as PackageJson;
  } else {
    return null;
  }
}

function __getNpmProjectsPaths(): string[] {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return [];
  }

  const paths = [];
  for (const folder of folders) {
    const npmProjectRoots: string[] = glob.sync(folder.uri.fsPath + '/**/package.json')
      .map((p: string) => path.dirname(p));
    paths.push(...npmProjectRoots.filter(p => !p.includes('node_modules')));
  }

  if (paths.length === 0) {
    return folders.map(f => f.uri.fsPath);
  }

  return paths;
}

function __getTauriProjectsPaths(): string[] {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return [];
  }

  const paths = [];
  for (const folder of folders) {
    const tauriProjectRoots: string[] = glob.sync(folder.uri.fsPath + '/**/src-tauri')
      .map((p: string) => path.dirname(p));
    paths.push(...tauriProjectRoots.filter(p => !p.includes('node_modules')));
  }
  return paths;
}

function __isMultiRoot(): boolean {
  if (vscode.workspace.workspaceFolders) {
    return vscode.workspace.workspaceFolders.length > 1;
  }
  return false;
}

function __runCommandInTerminal(command: string, args: string[], cwd: string | undefined): Promise<void> {
  return runInTerminal(command, args, { cwd, env: process.env }).then(process => {
    return new Promise((resolve, reject) => {
      process.on('exit', code => {
        if (code) {
          reject();
        } else {
          resolve();
        }
      });
    });
  });
}

function __runCommandInIntegratedTerminal(command: string, args: string[], cwd: string | undefined): Promise<void> {
  if (!terminal) {
    terminal = vscode.window.createTerminal('tauri');
  }

  terminal.show();
  if (cwd) {
    // Replace single backslash with double backslash.
    const textCwd = cwd.replace(/\\/g, '\\\\');
    terminal.sendText(['cd', `"${textCwd}"`].join(' '));
  }
  terminal.sendText(command + ' ' + args.join(' '));
  return Promise.resolve();
}

function __runCommandInOutputWindow(command: string, args: string[], cwd: string | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = command + ' ' + args.join(' ');
    const p = exec(cmd, { cwd, env: process.env });

    runningProcesses.set(p.pid, { process: p, cmd: cmd });

    p.stderr?.on('data', (data: string) => {
      outputChannel.append(data);
    });
    p.stdout?.on('data', (data: string) => {
      outputChannel.append(data);
    });
    p.on('exit', (_code: number, signal: string) => {
      runningProcesses.delete(p.pid);

      if (signal === 'SIGTERM') {
        outputChannel.appendLine('Successfully killed process');
        outputChannel.appendLine('-----------------------');
        outputChannel.appendLine('');
        reject();
      } else {
        outputChannel.appendLine('-----------------------');
        outputChannel.appendLine('');
        resolve();
      }
    });

    outputChannel.show(true);
  });
}

interface TauriProject {
  label: string
  projectPath: string
}

function __useTerminal() {
  return vscode.workspace.getConfiguration('npm')['runInTerminal'];
}

function __usePnpm(projectPath: string) {
    return fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'));
}

function __useYarn(projectPath: string) {
    return fs.existsSync(path.join(projectPath, 'yarn.lock'));
}

function __getNpmBin() {
    return vscode.workspace.getConfiguration('npm')['bin'] || 'npm';
}

function __getPackageManagerBin(projectPath: string) {
    return __usePnpm(projectPath) ? 'pnpm' : __useYarn(projectPath) ? 'yarn' : __getNpmBin();
}


interface RunOptions {
  noOutputWindow?: boolean
  cwd: string
}

function __runScript(command: string, args: string[], options: RunOptions) {
  vscode.window.showInformationMessage(`Running \`${command} ${args.join(' ')}\` in ${options.cwd}`);

  return vscode.workspace.saveAll().then(() => {
    if (__useTerminal() || options.noOutputWindow) {
      if (typeof vscode.window.createTerminal === 'function') {
        return __runCommandInIntegratedTerminal(command, args, options.cwd);
      } else {
        return __runCommandInTerminal(command, args, options.cwd);
      }
    } else {
      outputChannel.clear();
      return __runCommandInOutputWindow(command, args, options.cwd);
    }
  });
}

function __runTauriScript(args: string[], options: RunOptions): void {
  if (__isVueCliApp(options.cwd)) {
    const [cmd, ...cmgArgs] = args;
    __runScript(__getPackageManagerBin(options.cwd), ['run', `tauri:${cmd === 'dev' ? 'serve' : cmd}`, ...cmgArgs], options);
  } else {
    __runScript(__getPackageManagerBin(options.cwd), ['run', 'tauri', ...args], options);
  }
}

function __pickProjectAndRunTauriScript(runner: (projectPath: string) => void, getProjectPathsFn = __getTauriProjectsPaths): void {
  const tauriProjectsPaths = getProjectPathsFn();
  const projectList: TauriProject[] = [];

  for (const p of tauriProjectsPaths) {
    let label = path.basename(p);
    if (__isMultiRoot()) {
      const root = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p));
      if (root && root.name !== label) {
        label = `${root.name}: ${label}`;
      }
    }

    projectList.push({
      label,
      projectPath: p
    });
  }

  if (projectList.length === 0) {
    vscode.window.showErrorMessage('Tauri project not found');
    return;
  }

  if (projectList.length === 1) {
    runner(projectList[0].projectPath);
  } else {
    vscode.window.showQuickPick(projectList).then(project => {
      if (project) {
        runner(project.projectPath);
      }
    });
  }
}
