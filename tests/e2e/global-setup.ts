import { FullConfig } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import http from 'http';

let serverProc: any;

export default async function globalSetup(_config: FullConfig) {
  const cwd = process.cwd();
  if (process.env.ADMIN_SEED_EMAIL && process.env.ADMIN_SEED_PASSWORD) {
    await runNodeScript(path.join(cwd, 'scripts', 'ensure-admin.js')).catch(e=>{ console.warn('[globalSetup] ensure-admin échoué:', e.message); });
  } else {
    console.warn('[globalSetup] ADMIN_SEED_EMAIL/PASSWORD absents – un admin éphémère sera créé par les tests.');
  }
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const up = await isUp(baseURL).catch(()=>false);
  if (!up) {
    serverProc = spawn(process.platform === 'win32'? 'pnpm.cmd':'pnpm', ['dev'], { cwd, stdio: 'inherit' });
    let attempts = 0;
    while (attempts < 60) {
      attempts++; await new Promise(r=>setTimeout(r,1000));
      if (await isUp(baseURL).catch(()=>false)) break;
    }
  }
}

function runNodeScript(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cp = spawn(process.execPath, [file], { stdio: 'inherit' });
    cp.on('exit', code => code === 0 ? resolve() : reject(new Error(file + ' exited with code ' + code)));
  });
}
function isUp(url: string): Promise<boolean> {
  return new Promise((resolve)=> {
    const req = http.get(url+(url.endsWith('/')?'':'/')+'login', ()=>resolve(true)).on('error',()=>resolve(false));
    req.setTimeout(2000, ()=>{ req.destroy(); resolve(false); });
  });
}
