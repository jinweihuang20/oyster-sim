import { defineConfig } from 'vite';
import { execSync } from 'child_process';
const sh = (c: string) => { try { return execSync(c).toString().trim(); } catch { return ''; } };
const VER = (sh('git rev-parse --short HEAD') || 'dev') + '-' + Date.now().toString(36);
const TITLE = sh('git log -1 --pretty=%s');
const d = new Date(Date.now() + 8 * 3600e3).toISOString();
const preview = process.env.PREVIEW === '1';
export default defineConfig({ base: preview ? '/oyster-sim-preview/' : '/oyster-sim/', plugins: [{ name: 'version-json', apply: 'build', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VER, title: TITLE }) }); } }], define: { __VERSION__: JSON.stringify(VER), __BUILD__: JSON.stringify(d.slice(0, 10).replace(/-/g, '') + '.' + d.slice(11, 16).replace(':', '')), __PREVIEW__: JSON.stringify(preview) } });
