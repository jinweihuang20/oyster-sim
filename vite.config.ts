import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
// @ts-ignore 純 JS 腳本
import { buildCatalog } from './scripts/catalog.mjs';
const sh = (c: string) => { try { return execSync(c).toString().trim(); } catch { return ''; } };
const VER = (sh('git rev-parse --short HEAD') || 'dev') + '-' + Date.now().toString(36);
const TITLE = sh('git log -1 --pretty=%s');
const d = new Date(Date.now() + 8 * 3600e3).toISOString();
const preview = process.env.PREVIEW === '1';
export default defineConfig({
  base: preview ? '/oyster-sim-preview/' : '/oyster-sim/',
  // CF tunnel 會帶公開 Host；Vite 預設擋非 localhost（與 tunnel 無關，重啟後才生效）
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },

  plugins: [{
    name: 'version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VER, title: TITLE }) });
      this.emitFile({
        type: 'asset',
        fileName: 'catalog.json',
        source: JSON.stringify(buildCatalog(
          readFileSync('src/main.ts', 'utf8') + '\n' + readFileSync('src/shop/yardShop.ts', 'utf8') + '\n' + readFileSync('src/plaza/flags.ts', 'utf8') + '\n' + readFileSync('src/shop/meds.ts', 'utf8') + '\n' + readFileSync('src/shop/shopEquip.ts', 'utf8') + '\n' + readFileSync('src/world/locs.ts', 'utf8'),
          VER,
          readFileSync('src/shop/oddities.ts', 'utf8'),
          readFileSync('src/dm/weapons.ts', 'utf8'),
          readFileSync('src/shop/pets.ts', 'utf8'),
        )),
      });
    },
  }],
  define: {
    __VERSION__: JSON.stringify(VER),
    __BUILD__: JSON.stringify(d.slice(0, 10).replace(/-/g, '') + '.' + d.slice(11, 16).replace(':', '')),
    __PREVIEW__: JSON.stringify(preview),
  },
});

