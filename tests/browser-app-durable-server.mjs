import { createServer } from 'node:http';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { useAppStore } from './src/store/useAppStore.js';
      import { attachConflictPreconditions } from './src/services/syncConflictPolicy.js';
      window.attachConflictPreconditions = attachConflictPreconditions;
      function Harness() {
        const app = useAppStore();
        window.app = app;
        window.ready = app.persistence.ready;
        window.startupError = app.persistence.error;
        return React.createElement('main', null, app.persistence.error || (app.persistence.ready ? 'Actual hook ready' : 'Opening'));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Harness));
    `,
    resolveDir: process.cwd()
  },
  bundle: true, write: false, format: 'esm', platform: 'browser', define: { 'import.meta.env': '{}' }
});

const html = `<!doctype html><html><head><title>Actual app durable hook crash fixture</title></head><body>
<div id="root">Loading</div><script>
Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
sessionStorage.setItem('khodar_pos_session_token', 'isolated-test-token');
sessionStorage.setItem('khodar_verified_session_user', JSON.stringify({
  id: 'browser-hook-user', tenantId: 'browser-hook-tenant', role: 'cashier',
  branchId: 'browser-hook-main', branchIds: ['browser-hook-main'],
  sessionExpiresAt: new Date(Date.now() + 3600000).toISOString()
}));
localStorage.setItem('braka:browser-hook-tenant:browser-hook-user:khodar_pos_branches_v1', JSON.stringify([{
  id: 'browser-hook-main', tenantId: 'browser-hook-tenant',
  name: 'Main', code: 'BR-01', isMain: true, status: 'active'
}]));
localStorage.setItem('braka:browser-hook-tenant:browser-hook-user:khodar_pos_active_branch_id_v1',
  JSON.stringify('browser-hook-main'));
</script><script type="module" src="/app.js"></script></body></html>`;

const server = createServer((request, response) => {
  if (request.url === '/') {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(html);
  } else if (request.url === '/app.js') {
    response.setHeader('content-type', 'application/javascript; charset=utf-8');
    response.end(bundle.outputFiles[0].text);
  } else {
    response.writeHead(404); response.end();
  }
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Missing TCP test server port');
  console.log(`Actual hook harness: http://127.0.0.1:${address.port}`);
});
