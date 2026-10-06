/**
 * Central Cloud Tenants API (/api/tenants)
 * Manages Multi-Tenant store accounts across all platforms
 */

import { authenticateRequest, requireSuperAdmin } from '../../_lib/auth.js';
import { hashPassword } from '../../_lib/passwords.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-super-admin-key',
};

async function isAuthorizedSuperAdmin(request, env) {
  const auth = await authenticateRequest(request, env);
  return !requireSuperAdmin(auth);
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env || !env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database unavailable', tenants: [] }), { headers: CORS_HEADERS });
  }

  if (!(await isAuthorizedSuperAdmin(request, env))) {
    return new Response(JSON.stringify({
      success: false,
      error: 'غير مصرح: هذا الإجراء يتطلب صلاحيات مالك المنصة الرئيسي (Super Admin)'
    }), { status: 401, headers: CORS_HEADERS });
  }

  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM tenants ORDER BY created_at DESC"
    ).all();

    const formatted = (results || []).map(r => ({
      id: r.id,
      storeCode: r.store_code || 'BRK-101',
      companyName: r.company_name,
      username: r.username,
      role: r.role || 'company_owner',
      status: r.status || 'active',
      expiresAt: r.expires_at,
      allowedBranches: r.allowed_branches || 1,
      phone: r.phone || '',
      notes: r.notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return new Response(JSON.stringify({ success: true, tenants: formatted }), {
      headers: CORS_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message, tenants: [] }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env || !env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database unavailable' }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }

  if (!(await isAuthorizedSuperAdmin(request, env))) {
    return new Response(JSON.stringify({
      success: false,
      error: 'غير مصرح: إضافة المشتركين تتطلب صلاحيات مالك المنصة الرئيسي (Super Admin)'
    }), { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const id = body.id || `tenant-${Date.now()}`;
    const storeCode = (body.storeCode || '').trim().toUpperCase();
    const companyName = (body.companyName || '').trim();
    const username = (body.username || '').trim().toLowerCase();
    const password = body.password;
    const role = 'company_owner';
    const status = body.status || 'active';
    const expiresAt = body.expiresAt || '2099-12-31';
    const allowedBranches = body.allowedBranches == null ? 1 : Number(body.allowedBranches);
    const phone = (body.phone || '').trim();
    const notes = (body.notes || '').trim();
    const now = new Date().toISOString();
    const mainBranch = {
      id: `branch-${crypto.randomUUID()}`, tenantId: id, name: 'الفرع الرئيسي',
      code: 'BR-01', phone: '', address: '', managerName: '',
      isMain: true, status: 'active', createdAt: now
    };

    if (!username || !storeCode || typeof password !== 'string' || password.length < 12 ||
        !Number.isSafeInteger(allowedBranches) || allowedBranches < 1) {
      return new Response(JSON.stringify({ success: false, error: 'اسم المستخدم وكود المتجر وكلمة مرور قوية مطلوبة' }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    // Check conflict
    const existing = await env.DB.prepare(
      "SELECT id FROM tenants WHERE LOWER(username) = ? OR UPPER(store_code) = ? LIMIT 1"
    ).bind(username, storeCode).first();

    if (existing && existing.id !== id) {
      return new Response(JSON.stringify({ success: false, error: 'اسم المستخدم أو كود المتجر مسجل مسبقاً' }), {
        status: 409,
        headers: CORS_HEADERS
      });
    }

    await env.DB.batch([env.DB.prepare(
      `INSERT INTO tenants
       (id, store_code, company_name, username, password_hash, role, status, expires_at, allowed_branches, phone, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM tenants WHERE id = ?), ?), ?)`
    ).bind(
      id, storeCode, companyName, username, await hashPassword(password, env), role, status, expiresAt, allowedBranches, phone, notes, id, now, now
    ), env.DB.prepare(`INSERT INTO branches
      (id, tenant_id, name, code, phone, address, manager_name, is_main, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(mainBranch.id, id, mainBranch.name, mainBranch.code, mainBranch.phone,
        mainBranch.address, mainBranch.managerName, 1, mainBranch.status, now, now)]);

    const createdTenant = {
      id,
      storeCode,
      companyName,
      username,
      role,
      status,
      expiresAt,
      allowedBranches,
      phone,
      notes,
      createdAt: now,
      updatedAt: now
    };

    return new Response(JSON.stringify({ success: true, tenant: createdTenant, mainBranch }), {
      headers: CORS_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  if (!env || !env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database unavailable' }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }

  if (!(await isAuthorizedSuperAdmin(request, env))) {
    return new Response(JSON.stringify({
      success: false,
      error: 'غير مصرح: تعديل بيانات المشتركين تتطلب صلاحيات مالك المنصة الرئيسي (Super Admin)'
    }), { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'معرف المتجر (id) مطلوب' }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const target = await env.DB.prepare('SELECT role FROM tenants WHERE id = ?').bind(id).first();
    if (target?.role === 'super_admin') {
      return new Response(JSON.stringify({ success: false, error: 'Use the authenticated Platform Owner security settings to change this account' }), {
        status: 403, headers: CORS_HEADERS
      });
    }

    const updates = [];
    const bindings = [];

    if (body.storeCode !== undefined) {
      updates.push("store_code = ?");
      bindings.push(body.storeCode.trim().toUpperCase());
    }
    if (body.companyName !== undefined) {
      updates.push("company_name = ?");
      bindings.push(body.companyName.trim());
    }
    if (body.username !== undefined) {
      updates.push("username = ?");
      bindings.push(body.username.trim().toLowerCase());
    }
    if (body.password !== undefined) {
      updates.push("password_hash = ?");
      bindings.push(await hashPassword(body.password, env));
      updates.push("auth_version = COALESCE(auth_version, 0) + 1");
    }
    if (body.status !== undefined) {
      updates.push("status = ?");
      bindings.push(body.status);
    }
    if (body.expiresAt !== undefined) {
      updates.push("expires_at = ?");
      bindings.push(body.expiresAt);
    }
    if (body.allowedBranches !== undefined) {
      updates.push("allowed_branches = ?");
      bindings.push(Number(body.allowedBranches) || 1);
    }
    if (body.phone !== undefined) {
      updates.push("phone = ?");
      bindings.push(body.phone.trim());
    }
    if (body.notes !== undefined) {
      updates.push("notes = ?");
      bindings.push(body.notes.trim());
    }

    updates.push("updated_at = ?");
    bindings.push(new Date().toISOString());

    bindings.push(id);

    const sql = `UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`;
    await env.DB.prepare(sql).bind(...bindings).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: CORS_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!env || !env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database unavailable' }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }

  if (!(await isAuthorizedSuperAdmin(request, env))) {
    return new Response(JSON.stringify({
      success: false,
      error: 'غير مصرح: حذف المشتركين يتطلب صلاحيات مالك المنصة الرئيسي (Super Admin)'
    }), { status: 401, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'معرف المتجر مطلوب' }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const target = await env.DB.prepare('SELECT role FROM tenants WHERE id = ?').bind(id).first();
    if (target?.role === 'super_admin') return new Response(JSON.stringify({ success: false, error: 'Cannot delete platform administrator' }), { status: 403, headers: CORS_HEADERS });
    await env.DB.prepare("DELETE FROM tenants WHERE id = ?").bind(id).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: CORS_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
