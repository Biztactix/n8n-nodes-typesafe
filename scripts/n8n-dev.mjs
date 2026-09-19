// One command to try the node in a real n8n: `npm run n8n:dev`.
//
// Builds the package, links the built `dist/` into an isolated n8n user folder inside the repo
// (`.n8n-dev/`, gitignored) and starts n8n in the foreground with telemetry off.
//
// The real ~/.n8n is never touched: N8N_USER_FOLDER points at .n8n-dev, so the sqlite database,
// encryption key and settings all live there. Delete .n8n-dev/ to reset to a clean instance.
//
// n8n itself is not a dependency of this package (DECISIONS D-005: no runtime deps); it is run with
// `npx n8n@<version>`, so it lands in the npx cache instead of node_modules.
//
// This script never reads, prints or stores an API key. Enter the key in n8n's credential UI.

import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userFolder = path.join(repoRoot, '.n8n-dev');
const customDir = path.join(userFolder, 'custom');
const linkPath = path.join(customDir, 'n8n-nodes-typesafe');
const distDir = path.join(repoRoot, 'dist');

// Pin n8n so a run is reproducible; override with N8N_DEV_VERSION=x.y.z npm run n8n:dev.
const n8nVersion = process.env.N8N_DEV_VERSION ?? '2.39.8';
const port = process.env.N8N_PORT ?? '5678';

const run = (cmd, args, opts = {}) => {
	const result = spawnSync(cmd, args, { cwd: repoRoot, stdio: 'inherit', shell: false, ...opts });
	if (result.status !== 0) {
		console.error(`\n${cmd} ${args.join(' ')} failed (exit ${result.status ?? result.signal})`);
		process.exit(result.status ?? 1);
	}
};

// 1. Build, so n8n always loads the current source.
console.log('› building the package');
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);

// 2. Link dist/ into the custom-extensions directory. n8n's CustomDirectoryLoader globs
//    `**/*.node.js` and `**/*.credentials.js` under it, so linking dist/ (and not the repo root)
//    keeps node_modules and dist-test out of the scan. The link is refreshed every run.
mkdirSync(customDir, { recursive: true });
rmSync(linkPath, { recursive: true, force: true });
symlinkSync(distDir, linkPath, 'junction');
console.log(`› linked ${path.relative(repoRoot, linkPath)} -> ${path.relative(repoRoot, distDir)}`);

if (!existsSync(path.join(distDir, 'nodes', 'TypeSafe', 'typesafe.svg'))) {
	console.error('dist is missing the node icon; run `npm run build` and try again');
	process.exit(1);
}

// 3. Start n8n in the foreground against the isolated user folder, with telemetry and nags off.
const env = {
	...process.env,
	N8N_USER_FOLDER: userFolder,
	N8N_CUSTOM_EXTENSIONS: customDir,
	N8N_PORT: port,
	N8N_DIAGNOSTICS_ENABLED: 'false',
	N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
	N8N_PERSONALIZATION_ENABLED: 'false',
	N8N_TEMPLATES_ENABLED: 'false',
	N8N_HIRING_BANNER_ENABLED: 'false',
	EXTERNAL_FRONTEND_HOOKS_URLS: '',
	N8N_DIAGNOSTICS_CONFIG_FRONTEND: '',
	N8N_DIAGNOSTICS_CONFIG_BACKEND: '',
	N8N_SECURE_COOKIE: 'false',
	N8N_RUNNERS_ENABLED: 'true',
};

console.log(`› starting n8n@${n8nVersion} on http://localhost:${port} (user folder: .n8n-dev/)`);
console.log('› first run downloads n8n into the npx cache and can take several minutes');
console.log('› put the TypeSafe API key in n8n under Credentials → TypeSafe AI API; never in this repo');

// `detached` puts npx and the n8n process it spawns in their own process group, so Ctrl-C (or a
// SIGTERM to this script) can be forwarded to the whole group. Signalling npx alone leaves n8n
// running and the port bound.
const child = spawn('npx', ['-y', `n8n@${n8nVersion}`, 'start'], {
	cwd: repoRoot,
	env,
	stdio: 'inherit',
	shell: false,
	detached: true,
});

let stopping = false;
const stop = (signal) => {
	if (stopping) return;
	stopping = true;
	try {
		process.kill(-child.pid, signal);
	} catch {
		// the group is already gone
	}
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(signal));
child.on('exit', (code, signal) => {
	const requested = stopping; // Ctrl-C is a normal way to stop a dev server, so it is not a failure
	stop('SIGTERM');
	process.exit(requested ? 0 : signal ? 1 : (code ?? 0));
});
