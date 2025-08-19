#!/usr/bin/env node
/*
 * Script preview intelligent.
 * Objectif: démarrer l'appli en production locale sans rebuild systématique.
 * Règle:
 *  - Si aucune build existante (.next/BUILD_ID absent) => build.
 *  - Si FORCE_BUILD=1 => build forcée.
 *  - Sinon on compare le mtime de la build au mtime le plus récent des sources clés (src, prisma/schema.prisma, config fichiers).
 *  - Si une source est plus récente => rebuild, sinon start direct.
 *
 * Options env:
 *  FORCE_BUILD=1       Force la reconstruction.
 *  PREVIEW_VERBOSE=1   Log détaillé.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const verbose = process.env.PREVIEW_VERBOSE === '1';
const force = process.env.FORCE_BUILD === '1';

function log(msg) { console.log(msg); }
function info(msg) { console.log(`\x1b[36m[i]\x1b[0m ${msg}`); }
function warn(msg) { console.warn(`\x1b[33m[!]\x1b[0m ${msg}`); }
function success(msg) { console.log(`\x1b[32m[✓]\x1b[0m ${msg}`); }
function error(msg) { console.error(`\x1b[31m[✗]\x1b[0m ${msg}`); }

function newestMtime(targetPath) {
  let newest = 0;
  if (!fs.existsSync(targetPath)) return newest;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return stat.mtimeMs;
  // directory walk (shallow-ish for speed)
  const entries = fs.readdirSync(targetPath);
  for (const e of entries) {
    const p = path.join(targetPath, e);
    try {
      const s = fs.statSync(p);
      if (s.isDirectory()) {
        // limit depth to 2 to avoid huge walk
        const sub = fs.readdirSync(p).slice(0, 200);
        for (const subE of sub) {
          const sp = path.join(p, subE);
          try { const ss = fs.statSync(sp); if (ss.mtimeMs > newest) newest = ss.mtimeMs; } catch {/* ignore */}
        }
      } else {
        if (s.mtimeMs > newest) newest = s.mtimeMs;
      }
    } catch {/* ignore */}
  }
  return newest;
}

function collectSourcesMtime() {
  const candidates = [
    'src',
    'prisma/schema.prisma',
    'package.json',
    'next.config.ts',
    'tailwind.config.ts',
    'eslint.config.mjs'
  ];
  let newest = 0;
  for (const c of candidates) {
    const p = path.join(root, c);
    const m = newestMtime(p);
    if (m > newest) newest = m;
    if (verbose) info(`mtime ${c}: ${m || 'n/a'}`);
  }
  return newest;
}

function build() {
  info('Lancement build (pnpm build)...');
  const r = spawnSync('pnpm', ['build'], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    error('Build échouée');
    process.exit(r.status || 1);
  }
  success('Build terminée');
}

function start() {
  info('Démarrage (pnpm start)...');
  const r = spawnSync('pnpm', ['start'], { stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(r.status || 0);
}

(function main() {
  const buildIdPath = path.join(root, '.next', 'BUILD_ID');
  let needBuild = false;
  if (force) {
    info('FORCE_BUILD=1 -> rebuild forcé');
    needBuild = true;
  } else if (!fs.existsSync(buildIdPath)) {
    info('Pas de build existante détectée');
    needBuild = true;
  } else {
    const buildStat = fs.statSync(buildIdPath);
    const buildMtime = buildStat.mtimeMs;
    const sourcesMtime = collectSourcesMtime();
    if (verbose) info(`mtime build: ${buildMtime}`);
    if (sourcesMtime > buildMtime) {
      info('Sources plus récentes que la build');
      needBuild = true;
    } else {
      success('Build à jour (aucune reconstruction)');
    }
  }
  if (needBuild) build();
  start();
})();

