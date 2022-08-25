import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    vscode.window.showInformationMessage(
      JSON.stringify(vscode.workspace.workspaceFolders)
    );
    setTimeout(() => {}, 2000);
  });
});
