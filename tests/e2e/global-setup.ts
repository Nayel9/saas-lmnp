import { FullConfig } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import http from 'http';

let serverProc: any;

/**
 * Global setup: s'assure que l'utilisateur admin existe et que le seed est exécuté (optionnel) avant les tests.
 * Requiert les variables env SUPABASE_SERVICE_ROLE_KEY / ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD.
 */
export default async function globalSetup(_config: FullConfig) {
  const cwd = process.cwd();
  if (process.env.ADMIN_SEED_EMAIL && process.env.ADMIN_SEED_PASSWORD && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await runNodeScript(path.join(cwd, 'scripts', 'ensure-admin.js'));
  } else {
    console.warn('[globalSetup] Variables admin manquantes, on saute ensure-admin.js');
  }
  // Seed démo optionnel (ne pas échouer si absence de clé service role)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try { await runNodeScript(path.join(cwd, 'scripts', 'seed-demo.js')); } catch (e) { console.warn('[globalSetup] Seed demo ignoré:', (e as Error).message); }
  }
  // Lancer serveur (dev) si pas déjà up
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const up = await isUp(baseURL).catch(()=>false);
  if (!up) {
    serverProc = spawn(process.platform === 'win32'? 'pnpm.cmd':'pnpm', ['dev'], { cwd, stdio: 'inherit' });
    let attempts = 0;
    while (attempts < 60) { // ~60s max
      attempts++; await new Promise(r=>setTimeout(r,1000));
      if (await isUp(baseURL).catch(()=>false)) break;
    }
  }
}

function runNodeScript(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cp = spawn(process.execPath, [file], { stdio: 'inherit' });
    cp.on('exit', code => {
      if (code === 0) resolve(); else reject(new Error(file + ' exited with code ' + code));
    });
  });
}
function isUp(url: string): Promise<boolean> {
  return new Promise((resolve)=>{
    const req = http.get(url+(url.endsWith('/')?'':'/')+'login', ()=>{resolve(true);})
      .on('error',()=>resolve(false));
    req.setTimeout(2000, ()=>{ req.destroy(); resolve(false); });
  });
}
