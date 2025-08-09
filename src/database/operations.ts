import { Database } from 'sqlite';
import { ApiKey, LauncherAsset, JavaAsset, News } from './schema';
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
         (client_id, version, server, base_url, mods_manifest_url, rp_manifest_url, private_key, social_media) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            asset.client_id,
            asset.version,
            asset.server,
            asset.base_url,
            asset.mods_manifest_url,
            asset.rp_manifest_url,
            asset.private_key,
            asset.social_media || '{}'
        ]
    );
    
    return {
        id: result.lastID!,
        client_id: asset.client_id,
        version: asset.version,
        server: asset.server,
        base_url: asset.base_url,
        mods_manifest_url: asset.mods_manifest_url,
        rp_manifest_url: asset.rp_manifest_url,
        private_key: asset.private_key,
        social_media: asset.social_media || '{}',
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