/**
 * Cloudflare Worker API for ZGIRT Tobacco POS
 * Endpoints:
 * - POST /api/auth/login
 * - GET  /api/auth/me
 * - GET  /api/products
 * - POST /api/products
 * - POST /api/sales
 * - GET  /api/reports/dashboard
 * - POST /api/sync/push
 * - GET  /api/sync/pull
 */

import { verifyPassword, hashPassword, sha256 } from './crypto.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Health Endpoint
      if (url.pathname === '/api/health') {
        return json({ status: 'ok', product: 'ZGIRT POS', version: '1.0.0', time: new Date().toISOString() }, corsHeaders);
      }

      // 2. Auth: Login
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const { username, password, tenantId } = await request.json();
        if (!username || !password) return errorJson('Username and password required', 400, corsHeaders);

        let query = 'SELECT * FROM users WHERE username = ? AND status = "active"';
        const params = [username];
        if (tenantId) {
          query += ' AND tenant_id = ?';
          params.push(tenantId);
        }

        const user = await env.DB.prepare(query).bind(...params).first();
        if (!user) return errorJson('Invalid credentials', 401, corsHeaders);

        const passwordValid = await verifyPassword(password, user.password_hash);
        if (!passwordValid) return errorJson('Invalid credentials', 401, corsHeaders);

        // Generate session token
        const rawToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
        const tokenHash = await sha256(`${env.AUTH_SECRET}:${rawToken}`);
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

        await env.DB.prepare(
          `INSERT INTO sessions (id, token_hash, tenant_id, user_id, credential_version, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(sessionId, tokenHash, user.tenant_id, user.id, user.auth_version || 1, expiresAt).run();

        return json({
          success: true,
          token: rawToken,
          user: {
            id: user.id,
            tenantId: user.tenant_id,
            username: user.username,
            fullName: user.full_name,
            role: user.role,
            branchId: user.branch_id
          }
        }, corsHeaders);
      }

      // Authenticate Bearer Token for subsequent endpoints
      const auth = await authenticate(request, env);
      if (auth.error) {
        return errorJson(auth.error, 401, corsHeaders);
      }
      const { user } = auth;

      // 3. Auth Me
      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        return json({ success: true, user }, corsHeaders);
      }

      // 4. Products: List
      if (url.pathname === '/api/products' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM products WHERE tenant_id = ? AND is_active = 1 ORDER BY name_ar ASC'
        ).bind(user.tenantId).all();

        return json({ success: true, products: results || [] }, corsHeaders);
      }

      // 5. Products: Create
      if (url.pathname === '/api/products' && request.method === 'POST') {
        const body = await request.json();
        const productId = body.id || crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO products (
            id, tenant_id, name_ar, name_en, sku, category, packs_per_carton, units_per_pack,
            barcode_pack, barcode_carton, cost_pack_cents, retail_price_pack_cents,
            retail_price_carton_cents, wholesale_price_carton_cents, min_stock_alert_packs
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          productId, user.tenantId, body.name_ar, body.name_en || null, body.sku || null,
          body.category || 'cigarettes', body.packs_per_carton || 10, body.units_per_pack || 20,
          body.barcode_pack || null, body.barcode_carton || null,
          body.cost_pack_cents || 0, body.retail_price_pack_cents || 0,
          body.retail_price_carton_cents || 0, body.wholesale_price_carton_cents || 0,
          body.min_stock_alert_packs || 50
        ).run();

        return json({ success: true, id: productId }, corsHeaders);
      }

      // 6. POS Sales Submission
      if (url.pathname === '/api/sales' && request.method === 'POST') {
        const sale = await request.json();
        const invoiceId = sale.id || crypto.randomUUID();

        // Atomic multi-statement insertion
        const statements = [
          env.DB.prepare(`
            INSERT INTO sales_invoices (
              id, tenant_id, branch_id, shift_id, cashier_user_id, customer_id,
              invoice_number, sale_type, subtotal_cents, discount_cents, tax_cents,
              total_cents, paid_cash_cents, paid_card_cents, credit_due_cents,
              payment_status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            invoiceId, user.tenantId, sale.branchId || user.branchId || 'default-branch',
            sale.shiftId || null, user.id, sale.customerId || null,
            sale.invoiceNumber || `INV-${Date.now().toString(36).toUpperCase()}`,
            sale.saleType || 'retail', sale.subtotalCents, sale.discountCents || 0, 0,
            sale.totalCents, sale.paidCashCents || 0, sale.paidCardCents || 0,
            sale.creditDueCents || 0, sale.paymentStatus || 'paid', sale.notes || null
          )
        ];

        // Deduct branch inventory
        if (Array.isArray(sale.items)) {
          for (const item of sale.items) {
            statements.push(
              env.DB.prepare(`
                INSERT INTO sales_invoice_items (
                  id, tenant_id, invoice_id, product_id, unit_type, quantity, packs_count,
                  unit_price_cents, total_cents
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                crypto.randomUUID(), user.tenantId, invoiceId, item.productId,
                item.unitType, item.quantity, item.packsCount,
                item.unitPriceCents, item.totalCents
              )
            );
          }
        }

        // Update customer balance if credit sale
        if (sale.customerId && sale.creditDueCents > 0) {
          statements.push(
            env.DB.prepare(`
              UPDATE customers SET balance_cents = balance_cents + ?, updated_at = datetime('now')
              WHERE id = ? AND tenant_id = ?
            `).bind(sale.creditDueCents, sale.customerId, user.tenantId)
          );
        }

        await env.DB.batch(statements);
        return json({ success: true, invoiceId }, corsHeaders);
      }

      // 7. Reports: Dashboard overview
      if (url.pathname === '/api/reports/dashboard' && request.method === 'GET') {
        const salesTotal = await env.DB.prepare(`
          SELECT COALESCE(SUM(total_cents), 0) as totalSales,
                 COALESCE(SUM(paid_cash_cents), 0) as totalCash,
                 COALESCE(SUM(credit_due_cents), 0) as totalReceivables,
                 COUNT(*) as invoiceCount
          FROM sales_invoices WHERE tenant_id = ? AND payment_status != 'void'
        `).bind(user.tenantId).first();

        const productCount = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM products WHERE tenant_id = ? AND is_active = 1
        `).bind(user.tenantId).first();

        return json({
          success: true,
          metrics: {
            totalSalesCents: salesTotal.totalSales,
            totalCashCents: salesTotal.totalCash,
            totalReceivablesCents: salesTotal.totalReceivables,
            invoiceCount: salesTotal.invoiceCount,
            activeProducts: productCount.count
          }
        }, corsHeaders);
      }

      return errorJson('Endpoint not found', 404, corsHeaders);

    } catch (err) {
      console.error('API Error:', err);
      return errorJson(err.message || 'Internal Server Error', 500, corsHeaders);
    }
  }
};

async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return { error: 'Unauthorized: Missing or invalid token' };
  const token = authHeader.slice(7).trim();
  const tokenHash = await sha256(`${env.AUTH_SECRET}:${token}`);

  const session = await env.DB.prepare(`
    SELECT s.*, u.username, u.full_name, u.role, u.branch_id
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND datetime(s.expires_at) > datetime('now')
    LIMIT 1
  `).bind(tokenHash).first();

  if (!session) return { error: 'Session expired or invalid' };

  return {
    user: {
      id: session.user_id,
      tenantId: session.tenant_id,
      username: session.username,
      fullName: session.full_name,
      role: session.role,
      branchId: session.branch_id
    }
  };
}

function json(data, headers = {}) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

function errorJson(message, status = 400, headers = {}) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}
