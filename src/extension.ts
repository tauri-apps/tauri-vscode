import * as vscode from 'vscode';
import { exec, ChildProcess } from 'child_process';
import { runInTerminal } from 'run-in-terminal';
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
    vscode.commands.registerCommand('tauri.dev', runTauriDev),
    vscode.commands.registerCommand('tauri.build', runTauriBuild),
    vscode.commands.registerCommand('tauri.build-debug', runTauriBuildDebug),
    vscode.commands.registerCommand('tauri.init', runTauriInit)
  );
}

function runTauriInit(): void {
  __pickProjectAndRunTauriScript(projectPath => {
    const installCommand = fs.existsSync(path.join(projectPath, 'yarn.lock'))
      ? 'yarn add tauri'
      : `${__getNpmBin()} install tauri`;

    const [command, ...args] = (installCommand).split(' ');
    __runScript(command, args, projectPath).then(() => {
      __runTauriScript(projectPath, ['init']);
    });
  }, () => {
    const paths = __getNpmProjectsPaths();
    return paths.filter(p => {
      return !(p.includes('node_modules') || fs.existsSync(path.join(p, 'src-tauri')));
    });
  });
}

function runTauriDev(): void {
  __pickProjectAndRunTauriScript(projectPath => __runTauriScript(projectPath, ['dev']));
}

function runTauriBuild(): void {
  __pickProjectAndRunTauriScript(projectPath => __runTauriScript(projectPath, ['build']));
}

function runTauriBuildDebug(): void {
  __pickProjectAndRunTauriScript(projectPath => __runTauriScript(projectPath, ['build', '--debug']));
}

function __getNpmProjectsPaths(): string[] {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return [];
  }

  const paths = [];
  for (const folder of folders) {
    const npmProjectRoots = glob.sync(folder.uri.fsPath + '/**/package.json')
      .map((p: string) => path.dirname(p));
    paths.push(...npmProjectRoots);
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
    const tauriProjectRoots = glob.sync(folder.uri.fsPath + '/**/src-tauri')
      .map((p: string) => path.dirname(p));
    paths.push(...tauriProjectRoots);
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

function __getNpmBin() {
  return vscode.workspace.getConfiguration('npm')['bin'] || 'npm';
}

function __getNpxBin() {
  const npmBin = __getNpmBin();
  return npmBin.slice(0, npmBin.length - 1) + 'x';
}

function __runScript(command: string, args: string[], cwd: string) {
  vscode.window.showInformationMessage(`Running \`${command} ${args.join(' ')}\` in ${cwd}`);

  return vscode.workspace.saveAll().then(() => {
    if (__useTerminal()) {
      if (typeof vscode.window.createTerminal === 'function') {
        return __runCommandInIntegratedTerminal(command, args, cwd);
      } else {
        return __runCommandInTerminal(command, args, cwd);
      }
    } else {
      outputChannel.clear();
      return __runCommandInOutputWindow(command, args, cwd);
    }
  });
}

function __runTauriScript(cwd: string, args: string[]): void {
  __runScript(__getNpxBin(), ['tauri', ...args], cwd);
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
