// Test-only router: bundles the real Pages handlers and middleware into workerd.
export { PasswordCrypto } from '../workers/password-crypto/index.js';
import * as login from '../functions/api/tenants/lookup.js';
import * as users from '../functions/api/users/index.js';
import * as tenants from '../functions/api/tenants/index.js';
import * as push from '../functions/api/sync/push.js';
import * as pull from '../functions/api/sync/pull.js';
import * as rebase from '../functions/api/sync/rebase.js';
import * as conflicts from '../functions/api/sync/conflicts.js';
import * as resolutions from '../functions/api/sync/resolutions.js';
import * as dependencies from '../functions/api/sync/dependencies.js';
import * as branches from '../functions/api/branches/index.js';
import * as backup from '../functions/api/backup.js';
import * as trials from '../functions/api/trial-requests/index.js';
import * as releases from '../functions/api/releases/index.js';
import * as logout from '../functions/api/auth/logout.js';
import * as password from '../functions/api/auth/password.js';
import * as me from '../functions/api/auth/me.js';
import * as reset from '../functions/api/auth/reset.js';
import * as recovery from '../functions/api/auth/recovery-token.js';
import * as platformOwner from '../functions/api/auth/platform-owner.js';
import * as cashDrawers from '../functions/api/cash/drawers.js';
import * as cashShifts from '../functions/api/cash/shifts.js';
import * as closeCashShift from '../functions/api/cash/shifts/close.js';
import * as cashDevices from '../functions/api/cash/devices.js';
import * as cashGrants from '../functions/api/cash/grants.js';
import * as cashReplay from '../functions/api/cash/replay.js';
import { onRequest } from '../functions/api/_middleware.js';
const routes = { '/api/auth/me': me, '/api/auth/reset': reset, '/api/auth/recovery-token': recovery, '/api/tenants/lookup': login, '/api/users': users, '/api/tenants': tenants,
  '/api/sync/push': push, '/api/sync/pull': pull, '/api/sync/rebase': rebase, '/api/sync/conflicts': conflicts, '/api/sync/resolutions':resolutions, '/api/sync/dependencies':dependencies, '/api/branches': branches, '/api/backup': backup,
  '/api/trial-requests': trials, '/api/releases': releases, '/api/auth/logout': logout, '/api/auth/password': password,
  '/api/auth/platform-owner': platformOwner, '/api/cash/drawers': cashDrawers, '/api/cash/shifts': cashShifts,
  '/api/cash/shifts/close': closeCashShift, '/api/cash/devices': cashDevices, '/api/cash/grants': cashGrants, '/api/cash/replay':cashReplay };
export default {
  async fetch(request, env) {
    const handler = routes[new URL(request.url).pathname]?.['onRequest' + request.method[0] + request.method.slice(1).toLowerCase()];
    const context = { request, env, data: {}, next: () => handler ? handler(context) : new Response('Not found', { status: 404 }) };
    return onRequest(context);
  }
};
