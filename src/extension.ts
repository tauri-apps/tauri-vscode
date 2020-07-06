import * as vscode from 'vscode';
import { exec, ChildProcess } from 'child_process';
import { runInTerminal } from 'run-in-terminal';
const glob = require('glob');
const path = require('path');

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
    vscode.commands.registerCommand('tauri.build-debug', runTauriBuildDebug)
  );
}

function runTauriDev(): void {
  __pickProjectAndRunTauriScript(['dev']);
}

function runTauriBuild(): void {
  __pickProjectAndRunTauriScript(['build']);
}

function runTauriBuildDebug(): void {
  __pickProjectAndRunTauriScript(['build', '--debug']);
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

function __runCommandInTerminal(args: string[], cwd: string | undefined): void {
  runInTerminal(__getNpmBin(), ['run', ...args], { cwd, env: process.env });
}

function __runCommandInIntegratedTerminal(args: string[], cwd: string | undefined): void {
  const cmdArgs = Array.from(args);

  if (!terminal) {
    terminal = vscode.window.createTerminal('tauri');
  }

  terminal.show();
  if (cwd) {
    // Replace single backslash with double backslash.
    const textCwd = cwd.replace(/\\/g, '\\\\');
    terminal.sendText(['cd', `"${textCwd}"`].join(' '));
  }
  terminal.sendText(__getNpmBin() + ' run ' + cmdArgs.join(' '));
}

function __runCommandInOutputWindow(args: string[], cwd: string | undefined) {
  const cmd = __getNpmBin() + ' run ' + args.join(' ');
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
    } else {
      outputChannel.appendLine('-----------------------');
      outputChannel.appendLine('');
    }
  });

  outputChannel.show(true);
}

interface TauriProject {
  label: string
  projectPath: string
}

function __useTerminal() {
  return vscode.workspace.getConfiguration('npm')['runInTerminal'];
}

function __getNpmBin() {
  vscode.window.showInformationMessage(vscode.workspace.getConfiguration('npm')['bin']);
  return vscode.workspace.getConfiguration('npm')['bin'] || 'npm';
}

function __runTauriScript(cwd: string, args: string[]): void {
  const tauriCmd = `tauri ${args.join(' ')}`;
  vscode.window.showInformationMessage(`Running ${tauriCmd}`);
  vscode.workspace.saveAll().then(() => {
    if (__useTerminal()) {
      if (typeof vscode.window.createTerminal === 'function') {
        __runCommandInIntegratedTerminal(args, cwd);
      } else {
        __runCommandInTerminal(args, cwd);
      }
    } else {
      outputChannel.clear();
      __runCommandInOutputWindow(args, cwd);
    }
  });
}

function __pickProjectAndRunTauriScript(args: string[]): void {
  const tauriProjectsPaths = __getTauriProjectsPaths();
  const projectList: TauriProject[] = [];

  for (const p of tauriProjectsPaths) {
    let label = path.basename(p);
    if (__isMultiRoot()) {
      const root = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p));
      if (root) {
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
    __runTauriScript(projectList[0].projectPath, args);
  } else {
    vscode.window.showQuickPick(projectList).then(project => {
      if (project) {
        __runTauriScript(project.projectPath, args);
      }
    });
  }
}
