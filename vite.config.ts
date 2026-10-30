import { defineConfig } from 'vite';
const d = new Date(Date.now() + 8 * 3600e3).toISOString();
export default defineConfig({ base: '/oyster-sim/', define: { __BUILD__: JSON.stringify(d.slice(0, 10).replace(/-/g, '') + '.' + d.slice(11, 16).replace(':', '')) } });
