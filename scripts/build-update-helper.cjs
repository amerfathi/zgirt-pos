const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
if (process.platform !== 'win32') throw new Error('Native Windows helper must be built on Windows');
const root = path.resolve(__dirname, '..');
const compiler = path.join(process.env.SystemRoot, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
const target = path.join(root, 'build/Zgirt.UpdateHelper.exe');
fs.mkdirSync(path.dirname(target), { recursive: true });
execFileSync(compiler, ['/nologo', '/target:winexe', '/optimize+', '/reference:System.Windows.Forms.dll', `/out:${target}`, path.join(root, 'electron/native/UpdateHelper.cs')], { stdio: 'inherit', windowsHide: true });
console.log('Built native update helper from audited source');

