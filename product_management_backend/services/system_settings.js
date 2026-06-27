import crypto from 'node:crypto';
import db from '../database/database.js';

let systemSettingsSchemaReady = false;

export const ensureSystemSettingsSchema = async () => {
  if (systemSettingsSchemaReady) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_scope TEXT NOT NULL DEFAULT 'global',
      setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by_user_id TEXT,
      updated_by_name TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS theme_profiles (
      theme_id UUID PRIMARY KEY,
      theme_key TEXT UNIQUE NOT NULL,
      theme_name TEXT NOT NULL,
      theme_value JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      created_by_user_id TEXT,
      created_by_name TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS invoice_templates (
      template_id UUID PRIMARY KEY,
      template_key TEXT UNIQUE NOT NULL,
      template_name TEXT NOT NULL,
      template_category TEXT NOT NULL DEFAULT 'custom',
      template_value JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_by_user_id TEXT,
      created_by_name TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS notification_events (
      notification_id UUID PRIMARY KEY,
      notification_type TEXT NOT NULL,
      notification_title TEXT NOT NULL,
      notification_body TEXT,
      notification_channel TEXT NOT NULL DEFAULT 'in-app',
      notification_status TEXT NOT NULL DEFAULT 'queued',
      related_entity_type TEXT,
      related_entity_id TEXT,
      created_by_user_id TEXT,
      created_by_name TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  systemSettingsSchemaReady = true;
};

export const listSettings = async () => {
  await ensureSystemSettingsSchema();
  const result = await db.query(
    `SELECT setting_key, setting_scope, setting_value, updated_by_user_id, updated_by_name, updated_at
     FROM app_settings
     ORDER BY setting_scope ASC, setting_key ASC`
  );
  return result.rows || [];
};

export const upsertSetting = async ({ setting_key, setting_scope = 'global', setting_value = {}, updated_by_user_id = null, updated_by_name = null }) => {
  await ensureSystemSettingsSchema();
  if (!setting_key) {
    return { ok: false, message: 'Setting key is required' };
  }

  const result = await db.query(
    `INSERT INTO app_settings(setting_key, setting_scope, setting_value, updated_by_user_id, updated_by_name, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (setting_key) DO UPDATE SET
       setting_scope = EXCLUDED.setting_scope,
       setting_value = EXCLUDED.setting_value,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_by_name = EXCLUDED.updated_by_name,
       updated_at = NOW()
     RETURNING *`,
    [String(setting_key), setting_scope, JSON.stringify(setting_value || {}), updated_by_user_id, updated_by_name]
  );

  return { ok: true, setting: result.rows?.[0] || null };
};

export const listThemes = async () => {
  await ensureSystemSettingsSchema();
  const result = await db.query(
    `SELECT theme_id, theme_key, theme_name, theme_value, is_active, created_by_user_id, created_by_name, updated_at
     FROM theme_profiles
     ORDER BY is_active DESC, theme_name ASC`
  );
  return result.rows || [];
};

export const saveTheme = async ({ theme_id = null, theme_key, theme_name, theme_value = {}, is_active = false, created_by_user_id = null, created_by_name = null }) => {
  await ensureSystemSettingsSchema();
  if (!theme_key || !theme_name) {
    return { ok: false, message: 'Theme key and name are required' };
  }

  const resolvedThemeId = theme_id || crypto.randomUUID();
  const result = await db.query(
    `INSERT INTO theme_profiles(theme_id, theme_key, theme_name, theme_value, is_active, created_by_user_id, created_by_name, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (theme_key) DO UPDATE SET
       theme_name = EXCLUDED.theme_name,
       theme_value = EXCLUDED.theme_value,
       is_active = EXCLUDED.is_active,
       created_by_user_id = EXCLUDED.created_by_user_id,
       created_by_name = EXCLUDED.created_by_name,
       updated_at = NOW()
     RETURNING *`,
    [resolvedThemeId, theme_key, theme_name, JSON.stringify(theme_value || {}), Boolean(is_active), created_by_user_id, created_by_name]
  );

  if (is_active) {
    await db.query('UPDATE theme_profiles SET is_active = FALSE WHERE theme_key <> $1', [theme_key]);
  }

  return { ok: true, theme: result.rows?.[0] || null };
};

export const activateTheme = async (theme_key) => {
  await ensureSystemSettingsSchema();
  if (!theme_key) {
    return { ok: false, message: 'Theme key is required' };
  }

  await db.query('UPDATE theme_profiles SET is_active = FALSE');
  const result = await db.query('UPDATE theme_profiles SET is_active = TRUE, updated_at = NOW() WHERE theme_key = $1 RETURNING *', [theme_key]);
  if (!result.rows?.[0]) {
    return { ok: false, message: 'Theme not found' };
  }
  return { ok: true, theme: result.rows[0] };
};

export const deleteTheme = async (theme_key) => {
  await ensureSystemSettingsSchema();
  const result = await db.query('DELETE FROM theme_profiles WHERE theme_key = $1 RETURNING theme_key', [theme_key]);
  if (!result.rows?.[0]) {
    return { ok: false, message: 'Theme not found' };
  }
  return { ok: true, theme_key };
};

export const listInvoiceTemplates = async () => {
  await ensureSystemSettingsSchema();
  const result = await db.query(
    `SELECT template_id, template_key, template_name, template_category, template_value, is_default, created_by_user_id, created_by_name, updated_at
     FROM invoice_templates
     ORDER BY is_default DESC, template_name ASC`
  );
  return result.rows || [];
};

export const saveInvoiceTemplate = async ({ template_id = null, template_key, template_name, template_category = 'custom', template_value = {}, is_default = false, created_by_user_id = null, created_by_name = null }) => {
  await ensureSystemSettingsSchema();
  if (!template_key || !template_name) {
    return { ok: false, message: 'Template key and name are required' };
  }

  const resolvedTemplateId = template_id || crypto.randomUUID();
  const result = await db.query(
    `INSERT INTO invoice_templates(template_id, template_key, template_name, template_category, template_value, is_default, created_by_user_id, created_by_name, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (template_key) DO UPDATE SET
       template_name = EXCLUDED.template_name,
       template_category = EXCLUDED.template_category,
       template_value = EXCLUDED.template_value,
       is_default = EXCLUDED.is_default,
       created_by_user_id = EXCLUDED.created_by_user_id,
       created_by_name = EXCLUDED.created_by_name,
       updated_at = NOW()
     RETURNING *`,
    [resolvedTemplateId, template_key, template_name, template_category, JSON.stringify(template_value || {}), Boolean(is_default), created_by_user_id, created_by_name]
  );

  if (is_default) {
    await db.query('UPDATE invoice_templates SET is_default = FALSE WHERE template_key <> $1', [template_key]);
  }

  return { ok: true, template: result.rows?.[0] || null };
};

export const activateInvoiceTemplate = async (template_key) => {
  await ensureSystemSettingsSchema();
  if (!template_key) {
    return { ok: false, message: 'Template key is required' };
  }

  await db.query('UPDATE invoice_templates SET is_default = FALSE');
  const result = await db.query('UPDATE invoice_templates SET is_default = TRUE, updated_at = NOW() WHERE template_key = $1 RETURNING *', [template_key]);
  if (!result.rows?.[0]) {
    return { ok: false, message: 'Template not found' };
  }
  return { ok: true, template: result.rows[0] };
};

export const deleteInvoiceTemplate = async (template_key) => {
  await ensureSystemSettingsSchema();
  const result = await db.query('DELETE FROM invoice_templates WHERE template_key = $1 RETURNING template_key', [template_key]);
  if (!result.rows?.[0]) {
    return { ok: false, message: 'Template not found' };
  }
  return { ok: true, template_key };
};

export const listUsers = async () => {
  await ensureSystemSettingsSchema();
  const result = await db.query(`
    SELECT id, name, email, phone, role
    FROM users
    ORDER BY name ASC, id ASC
  `);
  return result.rows || [];
};

export const updateUserRole = async (userId, role) => {
  await ensureSystemSettingsSchema();
  if (!userId || !role) {
    return { ok: false, message: 'User id and role are required' };
  }

  const result = await db.query(
    `UPDATE users SET role = $2 WHERE CAST(id AS TEXT) = CAST($1 AS TEXT) RETURNING id, name, email, phone, role`,
    [String(userId), String(role)]
  );

  if (!result.rows?.[0]) {
    return { ok: false, message: 'User not found' };
  }

  return { ok: true, user: result.rows[0] };
};

export const listUserSessions = async (userId = null) => {
  await ensureSystemSettingsSchema();
  const params = [];
  let whereClause = '';
  if (userId) {
    params.push(String(userId));
    whereClause = 'WHERE CAST(user_id AS TEXT) = CAST($1 AS TEXT)';
  }

  const result = await db.query(
    `SELECT refresh_token_id, user_id, expires_at, revoked_at, created_at
     FROM refresh_tokens
     ${whereClause}
     ORDER BY created_at DESC, refresh_token_id DESC`,
    params
  );
  return result.rows || [];
};

export const listActivityLogs = async (limit = 100) => {
  await ensureSystemSettingsSchema();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 250));
  const result = await db.query(
    `SELECT notification_id, notification_type, notification_title, notification_body, notification_channel, notification_status, related_entity_type, related_entity_id, created_at
     FROM notification_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return result.rows || [];
};

export const saveReminderSettings = async (settings, user = {}) => {
  return upsertSetting({
    setting_key: 'reminder_settings',
    setting_scope: 'notifications',
    setting_value: settings,
    updated_by_user_id: user.id || user.email || null,
    updated_by_name: user.name || user.username || null,
  });
};

export const saveSupportSettings = async (settings, user = {}) => {
  return upsertSetting({
    setting_key: 'support_settings',
    setting_scope: 'support',
    setting_value: settings,
    updated_by_user_id: user.id || user.email || null,
    updated_by_name: user.name || user.username || null,
  });
};