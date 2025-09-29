import { Database } from 'sqlite';
import { ApiKey, LauncherAsset, JavaAsset, News, HwidLog, HwidBan, HwidJoined } from './schema';
import { createHash } from 'crypto';

/**
 * API Key Operations
 */

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

/**
 * Create a new API key
 */
export async function createApiKey(db: Database, key: string, name?: string): Promise<ApiKey> {
    const keyHash = hashApiKey(key);
    
    const result = await db.run(
        'INSERT INTO api_keys (key_hash, name) VALUES (?, ?)',
        [keyHash, name || null]
    );
    
    return {
        id: result.lastID!,
        key_hash: keyHash,
        name: name || '',
        is_active: true,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString()
    };
}

/**
 * Validate an API key
 */
export async function validateApiKey(db: Database, key: string): Promise<ApiKey | null> {
    const keyHash = hashApiKey(key);
    
    const apiKey = await db.get<ApiKey>(
        'SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1',
        [keyHash]
    );
    
    if (apiKey) {
        // Update last_used timestamp
        await db.run(
            'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?',
            [apiKey.id]
        );
    }
    
    return apiKey || null;
}

/**
 * Deactivate an API key
 */
export async function deactivateApiKey(db: Database, keyHash: string): Promise<boolean> {
    const result = await db.run(
        'UPDATE api_keys SET is_active = 0 WHERE key_hash = ?',
        [keyHash]
    );
    
    return result.changes! > 0;
}

/**
 * Get all API keys
 */
export async function getAllApiKeys(db: Database): Promise<ApiKey[]> {
    return await db.all<ApiKey[]>('SELECT * FROM api_keys ORDER BY created_at DESC');
}

/**
 * Launcher Asset Operations
 */

/**
 * Create a new launcher asset
 */
export async function createLauncherAsset(
    db: Database, 
    asset: Omit<LauncherAsset, 'id' | 'created_at' | 'updated_at'>
): Promise<LauncherAsset> {
    const result = await db.run(
        `INSERT INTO launcher_assets 
         (client_id, version, versions, server, base_url, mods_manifest_url, rp_manifest_url, version_configs, private_key, social_media, source, custom_json) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            asset.client_id,
            asset.version,
            (asset as any).versions || null,
            asset.server,
            asset.base_url,
            asset.mods_manifest_url,
            asset.rp_manifest_url,
            (asset as any).version_configs || null,
            asset.private_key,
            asset.social_media || '{}',
            (asset as any).source || 'standard',
            (asset as any).custom_json || null
        ]
    );
    
    return {
        id: result.lastID!,
        client_id: asset.client_id,
        version: asset.version,
        versions: (asset as any).versions || undefined,
        server: asset.server,
        base_url: asset.base_url,
        mods_manifest_url: asset.mods_manifest_url,
        rp_manifest_url: asset.rp_manifest_url,
        version_configs: (asset as any).version_configs || undefined,
        private_key: asset.private_key,
        social_media: asset.social_media || '{}',
        source: (asset as any).source || 'standard',
        custom_json: (asset as any).custom_json || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

/**
 * Get launcher asset by client ID
 */
export async function getLauncherAssetByClientId(db: Database, clientId: string): Promise<LauncherAsset | null> {
    const asset = await db.get<LauncherAsset>(
        'SELECT * FROM launcher_assets WHERE client_id = ?',
        [clientId]
    );
    return asset || null;
}

/**
 * Get launcher asset by version (for backward compatibility)
 */
export async function getLauncherAssetByVersion(db: Database, version: string): Promise<LauncherAsset | null> {
    const asset = await db.get<LauncherAsset>(
        'SELECT * FROM launcher_assets WHERE version = ?',
        [version]
    );
    return asset || null;
}

/**
 * Get all launcher assets
 */
export async function getAllLauncherAssets(db: Database): Promise<LauncherAsset[]> {
    return await db.all<LauncherAsset[]>('SELECT * FROM launcher_assets ORDER BY created_at DESC');
}

/**
 * Update a launcher asset
 */
export async function updateLauncherAsset(
    db: Database, 
    id: number, 
    updates: Partial<Omit<LauncherAsset, 'id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    const result = await db.run(
        `UPDATE launcher_assets SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [...values, id]
    );
    
    return result.changes! > 0;
}

/**
 * Format versions JSON string for API response.
 * If versions JSON is valid and non-empty array, return as array; otherwise return empty array.
 */
export function formatVersionsForApi(versionsJson: string | undefined | null): string[] {
    if (!versionsJson) return [];
    try {
        const parsed = JSON.parse(versionsJson);
        if (Array.isArray(parsed)) return parsed;
        return [];
    } catch {
        return [];
    }
}

/**
 * Delete a launcher asset
 */
export async function deleteLauncherAsset(db: Database, id: number): Promise<boolean> {
    const result = await db.run('DELETE FROM launcher_assets WHERE id = ?', [id]);
    return result.changes! > 0;
}

/**
 * Java Asset Operations
 */

/**
 * Create or update Java asset configuration
 */
export async function createJavaAsset(
    db: Database, 
    asset: Omit<JavaAsset, 'id' | 'created_at' | 'updated_at'>
): Promise<JavaAsset> {
    // Check if a Java asset already exists
    const existing = await db.get<JavaAsset>('SELECT * FROM java_assets LIMIT 1');
    
    if (existing) {
        // Update existing record
        await db.run(
            'UPDATE java_assets SET source = ?, java_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [asset.source, asset.java_data, existing.id]
        );
        
        return {
            id: existing.id,
            source: asset.source,
            java_data: asset.java_data,
            created_at: existing.created_at,
            updated_at: new Date().toISOString()
        };
    } else {
        // Create new record
        const result = await db.run(
            'INSERT INTO java_assets (source, java_data) VALUES (?, ?)',
            [asset.source, asset.java_data]
        );
        
        return {
            id: result.lastID!,
            source: asset.source,
            java_data: asset.java_data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }
}

/**
 * Get Java asset configuration
 */
export async function getJavaAsset(db: Database): Promise<JavaAsset | null> {
    const asset = await db.get<JavaAsset>('SELECT * FROM java_assets LIMIT 1');
    return asset || null;
}

/**
 * Update Java asset configuration
 */
export async function updateJavaAsset(
    db: Database, 
    updates: Partial<Omit<JavaAsset, 'id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    const result = await db.run(
        `UPDATE java_assets SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
        values
    );
    
    return result.changes! > 0;
}

/**
 * News Operations
 */

/**
 * Create a new news article
 */
export async function createNews(
    db: Database, 
    news: Omit<News, 'id' | 'created_at' | 'modified_at'>
): Promise<News> {
    const result = await db.run(
        'INSERT INTO news (client_id, title, description, image) VALUES (?, ?, ?, ?)',
        [news.client_id ?? null, news.title, news.description, news.image]
    );
    
    return {
        id: result.lastID!,
        client_id: news.client_id ?? null,
        title: news.title,
        description: news.description,
        image: news.image,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString()
    };
}

/**
 * Get all news articles
 */
export async function getAllNews(db: Database, clientId?: string | null): Promise<News[]> {
    if (typeof clientId === 'undefined') {
        return await db.all<News[]>('SELECT * FROM news ORDER BY created_at DESC');
    }
    if (clientId === null || clientId === '') {
        return await db.all<News[]>('SELECT * FROM news WHERE client_id IS NULL ORDER BY created_at DESC');
    }
    return await db.all<News[]>('SELECT * FROM news WHERE client_id = ? ORDER BY created_at DESC', [clientId]);
}

/**
 * Get news article by ID
 */
export async function getNewsById(db: Database, id: number): Promise<News | null> {
    const news = await db.get<News>('SELECT * FROM news WHERE id = ?', [id]);
    return news || null;
}

/**
 * Update a news article
 */
export async function updateNews(
    db: Database, 
    id: number, 
    updates: Partial<Omit<News, 'id' | 'created_at' | 'modified_at'>>
): Promise<boolean> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    const result = await db.run(
        `UPDATE news SET ${fields}, modified_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [...values, id]
    );
    
    return result.changes! > 0;
}

/**
 * Delete a news article
 */
export async function deleteNews(db: Database, id: number): Promise<boolean> {
    const result = await db.run('DELETE FROM news WHERE id = ?', [id]);
    return result.changes! > 0;
} 

/**
 * HWID Logs and Bans Operations
 */

export async function createHwidLog(
    db: Database,
    payload: Omit<HwidLog, 'id' | 'created_at'>
): Promise<HwidLog> {
    const result = await db.run(
        `INSERT INTO hwid_logs (hwid, launcher_install_uuid, player_name, account_type, login_date, ip_address, has_joined_with_this_hwid)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.hwid,
            payload.launcher_install_uuid,
            payload.player_name,
            payload.account_type,
            payload.login_date,
            (payload as any).ip_address || null,
            (payload as any).has_joined_with_this_hwid ? 1 : 0
        ]
    );
    return {
        id: result.lastID!,
        hwid: payload.hwid,
        launcher_install_uuid: payload.launcher_install_uuid,
        player_name: payload.player_name,
        account_type: payload.account_type,
        login_date: payload.login_date,
        ip_address: (payload as any).ip_address || null,
        has_joined_with_this_hwid: !!(payload as any).has_joined_with_this_hwid,
        created_at: new Date().toISOString()
    };
}

export interface HwidLogSearchFilters {
    hwid?: string;
    launcher_install_uuid?: string;
    player_name?: string;
    account_type?: string;
    ip_address?: string;
    has_joined_with_this_hwid?: boolean;
    from_date?: string; // ISO date/time
    to_date?: string;   // ISO date/time
    limit?: number;
    offset?: number;
}

export async function searchHwidLogs(db: Database, filters: HwidLogSearchFilters): Promise<{ total: number; logs: HwidLog[]; } > {
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (filters.hwid) { whereClauses.push('hwid LIKE ?'); params.push(`%${filters.hwid}%`); }
    if (filters.launcher_install_uuid) { whereClauses.push('launcher_install_uuid LIKE ?'); params.push(`%${filters.launcher_install_uuid}%`); }
    if (filters.player_name) { whereClauses.push('player_name LIKE ?'); params.push(`%${filters.player_name}%`); }
    if (filters.account_type) { whereClauses.push('account_type = ?'); params.push(filters.account_type); }
    if (filters.ip_address) { whereClauses.push('ip_address LIKE ?'); params.push(`%${filters.ip_address}%`); }
    if (typeof filters.has_joined_with_this_hwid === 'boolean') { whereClauses.push('has_joined_with_this_hwid = ?'); params.push(filters.has_joined_with_this_hwid ? 1 : 0); }
    if (filters.from_date) { whereClauses.push('login_date >= ?'); params.push(filters.from_date); }
    if (filters.to_date) { whereClauses.push('login_date <= ?'); params.push(filters.to_date); }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const totalRow = await db.get<{ count: number }>(`SELECT COUNT(*) as count FROM hwid_logs ${whereSql}`, params);

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);

    const logs = await db.all<HwidLog[]>(
        `SELECT * FROM hwid_logs ${whereSql} ORDER BY login_date DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return { total: totalRow?.count || 0, logs };
}

export async function getHwidLogById(db: Database, id: number): Promise<HwidLog | null> {
    const row = await db.get<HwidLog>('SELECT * FROM hwid_logs WHERE id = ?', [id]);
    return row || null;
}

export async function isHwidBanned(db: Database, hwid: string): Promise<boolean> {
    const row = await db.get<{ id: number }>('SELECT id FROM hwid_bans WHERE hwid = ?', [hwid]);
    return !!row;
}

export async function createHwidBan(db: Database, hwid: string, reason: string): Promise<HwidBan> {
    // Upsert: if exists, update reason and timestamp; otherwise insert
    await db.run(
        `INSERT INTO hwid_bans (hwid, reason) VALUES (?, ?)
         ON CONFLICT(hwid) DO UPDATE SET reason = excluded.reason, created_at = CURRENT_TIMESTAMP`,
        [hwid, reason || '']
    );
    const ban = await db.get<HwidBan>('SELECT * FROM hwid_bans WHERE hwid = ?', [hwid]);
    return ban as HwidBan;
}

export async function deleteHwidBan(db: Database, hwid: string): Promise<boolean> {
    const result = await db.run('DELETE FROM hwid_bans WHERE hwid = ?', [hwid]);
    return result.changes! > 0;
}

export async function listHwidBans(db: Database): Promise<HwidBan[]> {
    return await db.all<HwidBan[]>('SELECT * FROM hwid_bans ORDER BY created_at DESC');
}

// Irreversible "joined" marks
export async function markHwidJoined(db: Database, hwid: string): Promise<HwidJoined> {
    await db.run(
        `INSERT INTO hwid_joined (hwid) VALUES (?)
         ON CONFLICT(hwid) DO NOTHING`,
        [hwid]
    );
    const row = await db.get<HwidJoined>('SELECT * FROM hwid_joined WHERE hwid = ?', [hwid]);
    return row as HwidJoined;
}

export async function isHwidJoined(db: Database, hwid: string): Promise<boolean> {
    const row = await db.get<{ id: number }>('SELECT id FROM hwid_joined WHERE hwid = ?', [hwid]);
    return !!row;
}