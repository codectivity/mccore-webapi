import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../database';
import { 
    createApiKey, 
    getAllApiKeys, 
    deactivateApiKey,
    createLauncherAsset,
    getAllLauncherAssets,
    getLauncherAssetByClientId,
    updateLauncherAsset,
    deleteLauncherAsset,
    createJavaAsset,
    getJavaAsset,
    updateJavaAsset,
    createNews,
    getAllNews,
    getNewsById,
    updateNews,
    deleteNews,
    searchHwidLogs,
    createHwidBan,
    deleteHwidBan,
    listHwidBans
} from '../database/operations';
import { authenticateApiKey } from '../middleware/auth';

const adminRouter = Router();

// All admin routes require API key authentication
adminRouter.use((req: Request, res: Response, next: NextFunction) => {
    authenticateApiKey(req, res, next);
});

/**
 * API Key Management Routes
 */

// Create a new API key
adminRouter.post('/keys', async (req: Request, res: Response) => {
    try {
        const { key, name } = req.body;
        
        if (!key) {
            res.status(400).json({ 
                error: 'Bad Request', 
                message: 'API key is required' 
            });
            return;
        }
        
        const db = getDatabase();
        const newKey = await createApiKey(db, key, name);
        
        res.status(201).json({
            message: 'API key created successfully',
            key: {
                id: newKey.id,
                name: newKey.name,
                created_at: newKey.created_at
            }
        });
    } catch (error) {
        console.error('Error creating API key:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to create API key' 
        });
    }
});

// Get all API keys
adminRouter.get('/keys', async (_req: Request, res: Response) => {
    try {
        const db = getDatabase();
        const keys = await getAllApiKeys(db);
        
        res.json({
            keys: keys.map(key => ({
                id: key.id,
                name: key.name,
                is_active: key.is_active,
                created_at: key.created_at,
                last_used: key.last_used
            }))
        });
    } catch (error) {
        console.error('Error fetching API keys:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to fetch API keys' 
        });
    }
});

// Deactivate an API key
adminRouter.delete('/keys/:keyHash', async (req: Request, res: Response) => {
    try {
        const { keyHash } = req.params;
        const db = getDatabase();
        const success = await deactivateApiKey(db, keyHash);
        
        if (success) {
            res.json({ message: 'API key deactivated successfully' });
        } else {
            res.status(404).json({ 
                error: 'Not Found', 
                message: 'API key not found' 
            });
        }
    } catch (error) {
        console.error('Error deactivating API key:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to deactivate API key' 
        });
    }
});

/**
 * Launcher Asset Management Routes
 */

// Create a new launcher asset
adminRouter.post('/assets', async (req: Request, res: Response) => {
    try {
        const { client_id } = req.body;
        let { version, versions, server, base_url, mods_manifest_url, rp_manifest_url, version_configs, private_key, social_media } = req.body as any;
        
        if (!client_id || !version || !server || !private_key) {
            res.status(400).json({ 
                error: 'Bad Request', 
                message: 'client_id, version, server, and private_key are required' 
            });
            return;
        }
        
        // Convert \n to actual newlines in private key
        const formattedPrivateKey = private_key.replace(/\\n/g, '\n');
        
        console.log('Original private key length:', private_key.length);
        console.log('Formatted private key length:', formattedPrivateKey.length);
        console.log('Private key starts with:', formattedPrivateKey.substring(0, 50));
        console.log('Private key ends with:', formattedPrivateKey.substring(formattedPrivateKey.length - 30));
        
        const db = getDatabase();
        // Normalize versions: merge version and versions into one array
        let versionsArray: string[] = [];
        if (Array.isArray(version)) {
            versionsArray = version.filter((v: any) => typeof v === 'string' && v.trim()).map((v: string) => v.trim());
        } else if (typeof version === 'string' && version.trim()) {
            versionsArray = [version.trim()];
        }
        if (Array.isArray(versions)) {
            versionsArray = versionsArray.concat(versions.filter((v: any) => typeof v === 'string' && v.trim()).map((v: string) => v.trim()));
        } else if (typeof versions === 'string' && versions.trim()) {
            try { const arr = JSON.parse(versions); if (Array.isArray(arr)) versionsArray = versionsArray.concat(arr); } catch {}
        }
        // De-duplicate while preserving order
        versionsArray = Array.from(new Set(versionsArray));
        const defaultVersion = versionsArray[0] || (typeof version === 'string' ? version : '');
        const normalizedVersions = versionsArray.length > 0 ? JSON.stringify(versionsArray) : undefined;

        // Handle version_configs: accept object or JSON string
        let versionConfigsObj: Record<string, { base_url: string; mods_manifest_url: string; rp_manifest_url: string; }> | null = null;
        if (typeof version_configs !== 'undefined') {
            if (typeof version_configs === 'string') {
                try { versionConfigsObj = JSON.parse(version_configs); } catch { versionConfigsObj = null; }
            } else if (typeof version_configs === 'object' && version_configs !== null) {
                versionConfigsObj = version_configs;
            }
        }

        // If per-version configs provided, derive top-level URLs from default version config
        if (versionConfigsObj && versionConfigsObj[defaultVersion]) {
            if (!base_url) base_url = versionConfigsObj[defaultVersion].base_url;
            if (!mods_manifest_url) mods_manifest_url = versionConfigsObj[defaultVersion].mods_manifest_url;
            if (!rp_manifest_url) rp_manifest_url = versionConfigsObj[defaultVersion].rp_manifest_url;
        }

        // Validate we have some URL sources (either top-level or per-version default)
        if (!base_url || !mods_manifest_url || !rp_manifest_url) {
            res.status(400).json({
                error: 'Bad Request',
                message: 'base_url, mods_manifest_url, and rp_manifest_url are required (provide under version_configs for the default version or as top-level)'
            });
            return;
        }
        const asset = await createLauncherAsset(db, {
            client_id,
            version: defaultVersion,
            versions: normalizedVersions as any,
            server,
            base_url,
            mods_manifest_url,
            rp_manifest_url,
            version_configs: versionConfigsObj ? JSON.stringify(versionConfigsObj) : undefined as any,
            private_key: formattedPrivateKey,
            social_media: social_media ? JSON.stringify(social_media) : '{}'
        });
        
        res.status(201).json({
            message: 'Launcher asset created successfully',
            asset: {
                id: asset.id,
                client_id: asset.client_id,
                version: (asset.versions ? JSON.parse(asset.versions) : (asset.version ? [asset.version] : [])),
                server: asset.server,
                base_url: asset.base_url,
                mods_manifest_url: asset.mods_manifest_url,
                rp_manifest_url: asset.rp_manifest_url,
                version_configs: asset.version_configs ? JSON.parse(asset.version_configs as any) : null,
                social_media: asset.social_media,
                created_at: asset.created_at
            }
        });
    } catch (error) {
        console.error('Error creating launcher asset:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to create launcher asset' 
        });
    }
});

// Get all launcher assets
adminRouter.get('/assets', async (_req: Request, res: Response) => {
    try {
        const db = getDatabase();
        const assets = await getAllLauncherAssets(db);
        
        res.json({
            assets: assets.map(asset => ({
                id: asset.id,
                client_id: asset.client_id,
                version: (asset.versions ? JSON.parse(asset.versions) : (asset.version ? [asset.version] : [])),
                server: asset.server,
                base_url: asset.base_url,
                mods_manifest_url: asset.mods_manifest_url,
                rp_manifest_url: asset.rp_manifest_url,
                version_configs: asset.version_configs ? JSON.parse(asset.version_configs as any) : null,
                social_media: asset.social_media,
                created_at: asset.created_at,
                updated_at: asset.updated_at
            }))
        });
    } catch (error) {
        console.error('Error fetching launcher assets:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to fetch launcher assets' 
        });
    }
});

// Get launcher asset by client ID
adminRouter.get('/assets/:clientId', async (req: Request, res: Response) => {
    try {
        const { clientId } = req.params;
        const db = getDatabase();
        const asset = await getLauncherAssetByClientId(db, clientId);
        
        if (!asset) {
            res.status(404).json({ 
                error: 'Not Found', 
                message: `Launcher asset for client_id ${clientId} not found` 
            });
            return;
        }
        
        res.json({
            asset: {
                id: asset.id,
                client_id: asset.client_id,
                version: (asset.versions ? JSON.parse(asset.versions) : (asset.version ? [asset.version] : [])),
                server: asset.server,
                base_url: asset.base_url,
                mods_manifest_url: asset.mods_manifest_url,
                rp_manifest_url: asset.rp_manifest_url,
                version_configs: asset.version_configs ? JSON.parse(asset.version_configs as any) : null,
                social_media: asset.social_media,
                created_at: asset.created_at,
                updated_at: asset.updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching launcher asset:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to fetch launcher asset' 
        });
    }
});

// Update launcher asset
adminRouter.put('/assets/:clientId', async (req: Request, res: Response) => {
    try {
        const { clientId } = req.params;
        const updates = { ...req.body } as any;
        if (typeof updates.private_key === 'string') {
            updates.private_key = updates.private_key.replace(/\\n/g, '\n');
        }
        // Normalize version_configs
        if (typeof updates.version_configs !== 'undefined') {
            if (updates.version_configs && typeof updates.version_configs === 'object') {
                updates.version_configs = JSON.stringify(updates.version_configs);
            } else if (typeof updates.version_configs === 'string') {
                try {
                    JSON.parse(updates.version_configs);
                } catch {
                    delete updates.version_configs; // invalid JSON; ignore
                }
            } else if (updates.version_configs === null) {
                updates.version_configs = null;
            }
        }
        // If client sent merged version array, split into default + versions JSON
        if (typeof updates.version !== 'undefined') {
            let versionsArray: string[] = [];
            if (Array.isArray(updates.version)) {
                versionsArray = updates.version.filter((v: any) => typeof v === 'string' && v.trim()).map((v: string) => v.trim());
            } else if (typeof updates.version === 'string' && updates.version.trim()) {
                try {
                    // Accept JSON string or single version string
                    const maybeArr = JSON.parse(updates.version);
                    if (Array.isArray(maybeArr)) versionsArray = maybeArr;
                    else versionsArray = [updates.version.trim()];
                } catch {
                    versionsArray = [updates.version.trim()];
                }
            }
            if (Array.isArray(updates.versions)) {
                versionsArray = versionsArray.concat(updates.versions.filter((v: any) => typeof v === 'string' && v.trim()).map((v: string) => v.trim()));
            } else if (typeof updates.versions === 'string' && updates.versions.trim()) {
                try { const arr = JSON.parse(updates.versions); if (Array.isArray(arr)) versionsArray = versionsArray.concat(arr); } catch {}
            }
            versionsArray = Array.from(new Set(versionsArray));
            if (versionsArray.length > 0) {
                updates.version = versionsArray[0];
                updates.versions = JSON.stringify(versionsArray);
            } else {
                // If empty, remove to avoid overwriting with blank
                delete updates.version;
                delete updates.versions;
            }
        } else if (typeof updates.versions !== 'undefined') {
            // Backward compat: only versions provided
            if (Array.isArray(updates.versions)) {
                const arr = updates.versions.filter((v: any) => typeof v === 'string' && v.trim()).map((v: string) => v.trim());
                if (arr.length > 0) {
                    updates.version = arr[0];
                    updates.versions = JSON.stringify(arr);
                } else {
                    delete updates.versions;
                }
            } else if (typeof updates.versions === 'string') {
                try {
                    const arr = JSON.parse(updates.versions);
                    if (Array.isArray(arr) && arr.length > 0) {
                        updates.version = arr[0];
                        updates.versions = JSON.stringify(arr);
                    } else {
                        delete updates.versions;
                    }
                } catch {
                    delete updates.versions;
                }
            }
        }
        
        const db = getDatabase();
        const asset = await getLauncherAssetByClientId(db, clientId);
        
        if (!asset) {
            res.status(404).json({ 
                error: 'Not Found', 
                message: `Launcher asset for client_id ${clientId} not found` 
            });
            return;
        }
        
        const success = await updateLauncherAsset(db, asset.id, updates);
        
        if (success) {
            res.json({ message: 'Launcher asset updated successfully' });
        } else {
            res.status(500).json({ 
                error: 'Internal Server Error', 
                message: 'Failed to update launcher asset' 
            });
        }
    } catch (error) {
        console.error('Error updating launcher asset:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to update launcher asset' 
        });
    }
});

// Delete launcher asset
adminRouter.delete('/assets/:clientId', async (req: Request, res: Response) => {
    try {
        const { clientId } = req.params;
        const db = getDatabase();
        const asset = await getLauncherAssetByClientId(db, clientId);
        
        if (!asset) {
            res.status(404).json({ 
                error: 'Not Found', 
                message: `Launcher asset for client_id ${clientId} not found` 
            });
            return;
        }
        
        const success = await deleteLauncherAsset(db, asset.id);
        
        if (success) {
            res.json({ message: 'Launcher asset deleted successfully' });
        } else {
            res.status(500).json({ 
                error: 'Internal Server Error', 
                message: 'Failed to delete launcher asset' 
            });
        }
    } catch (error) {
        console.error('Error deleting launcher asset:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to delete launcher asset' 
        });
    }
});

/**
 * Java Asset Management Routes
 */

// Create or update Java asset configuration
adminRouter.post('/java', async (req: Request, res: Response) => {
    try {
        const { source, java_data } = req.body;
        
        if (!source || !['Codectivity-cdn', 'custom'].includes(source)) {
            res.status(400).json({ 
                error: 'Bad Request', 
                message: 'source must be either "Codectivity-cdn" or "custom"' 
            });
            return;
        }
        
        if (source === 'custom' && !java_data) {
            res.status(400).json({ 
                error: 'Bad Request', 
                message: 'java_data is required when source is "custom"' 
            });
            return;
        }
        
        const db = getDatabase();
        const asset = await createJavaAsset(db, {
            source,
            java_data: source === 'custom' ? JSON.stringify(java_data) : ''
        });
        
        res.status(201).json({
            message: 'Java asset configuration updated successfully',
            asset: {
                id: asset.id,
                source: asset.source,
                created_at: asset.created_at,
                updated_at: asset.updated_at
            }
        });
    } catch (error) {
        console.error('Error creating Java asset:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to create Java asset configuration' 
        });
    }
});

// Get Java asset configuration
adminRouter.get('/java', async (_req: Request, res: Response) => {
    try {
        const db = getDatabase();
        const asset = await getJavaAsset(db);
        
        if (!asset) {
            res.status(404).json({ 
                error: 'Not Found', 
                message: 'Java asset configuration not found' 
            });
            return;
        }
        
        res.json({
            asset: {
                id: asset.id,
                source: asset.source,
                java_data: asset.source === 'custom' ? JSON.parse(asset.java_data) : null,
                created_at: asset.created_at,
                updated_at: asset.updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching Java asset:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to fetch Java asset configuration' 
        });
    }
});

// Update Java asset configuration
adminRouter.put('/java', async (req: Request, res: Response) => {
    try {
        const { source, java_data } = req.body;
        const updates: any = {};
        
        if (source && ['Codectivity-cdn', 'custom'].includes(source)) {
            updates.source = source;
        }
        
        if (java_data && source === 'custom') {
            updates.java_data = JSON.stringify(java_data);
        }
        
        if (Object.keys(updates).length === 0) {
            res.status(400).json({ 
                error: 'Bad Request', 
                message: 'No valid updates provided' 
            });
            return;
        }
        
        const db = getDatabase();
        const success = await updateJavaAsset(db, updates);
        
        if (success) {
            res.json({ message: 'Java asset configuration updated successfully' });
        } else {
            res.status(404).json({ 
                error: 'Not Found', 
                message: 'Java asset configuration not found' 
            });
        }
    } catch (error) {
        console.error('Error updating Java asset:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to update Java asset configuration' 
        });
    }
});

/**
 * News Management Routes
 */

// Create a new news article (optionally scoped to a client_id)
adminRouter.post('/news', async (req: Request, res: Response) => {
    try {
        const { client_id, title, description, image } = req.body;
        
        if (!title || !description) {
            res.status(400).json({ 
                error: 'Bad Request', 
                message: 'title and description are required' 
            });
            return;
        }
        
        const db = getDatabase();
        const news = await createNews(db, {
            client_id: client_id ?? null,
            title,
            description,
            image: image || ''
        });
        
        res.status(201).json({
            message: 'News article created successfully',
            news: {
                id: news.id,
                client_id: news.client_id ?? null,
                title: news.title,
                description: news.description,
                image: news.image,
                created_at: news.created_at,
                modified_at: news.modified_at
            }
        });
    } catch (error) {
        console.error('Error creating news article:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to create news article' 
        });
    }
});

// Get all news articles (optionally filtered by client_id)
adminRouter.get('/news', async (req: Request, res: Response) => {
    try {
        const db = getDatabase();
        const clientId = (req.query.client_id as string | undefined) ?? undefined;
        const news = await getAllNews(db, clientId);
        
        res.json({
            news: news.map(article => ({
                id: article.id,
                client_id: article.client_id ?? null,
                title: article.title,
                description: article.description,
                image: article.image,
                created_at: article.created_at,
                modified_at: article.modified_at
            }))
        });
    } catch (error) {
        console.error('Error fetching news articles:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to fetch news articles' 
        });
    }
});

// Get news article by ID
adminRouter.get('/news/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db = getDatabase();
        const news = await getNewsById(db, parseInt(id));
        
        if (!news) {
            res.status(404).json({ 
                error: 'Not Found', 
                message: `News article with ID ${id} not found` 
            });
            return;
        }
        
        res.json({
            news: {
                id: news.id,
                client_id: news.client_id ?? null,
                title: news.title,
                description: news.description,
                image: news.image,
                created_at: news.created_at,
                modified_at: news.modified_at
            }
        });
    } catch (error) {
        console.error('Error fetching news article:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to fetch news article' 
        });
    }
});

// Update news article
adminRouter.put('/news/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const db = getDatabase();
        const news = await getNewsById(db, parseInt(id));
        
        if (!news) {
            res.status(404).json({ 
                error: 'Not Found', 
                message: `News article with ID ${id} not found` 
            });
            return;
        }
        
        const success = await updateNews(db, parseInt(id), updates);
        
        if (success) {
            res.json({ message: 'News article updated successfully' });
        } else {
            res.status(500).json({ 
                error: 'Internal Server Error', 
                message: 'Failed to update news article' 
            });
        }
    } catch (error) {
        console.error('Error updating news article:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to update news article' 
        });
    }
});

// Delete news article
adminRouter.delete('/news/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db = getDatabase();
        const news = await getNewsById(db, parseInt(id));
        
        if (!news) {
            res.status(404).json({ 
                error: 'Not Found', 
                message: `News article with ID ${id} not found` 
            });
            return;
        }
        
        const success = await deleteNews(db, parseInt(id));
        
        if (success) {
            res.json({ message: 'News article deleted successfully' });
        } else {
            res.status(500).json({ 
                error: 'Internal Server Error', 
                message: 'Failed to delete news article' 
            });
        }
    } catch (error) {
        console.error('Error deleting news article:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to delete news article' 
        });
    }
});

/**
 * HWID Logs and Bans (Protected)
 */

// Search HWID logs with filters and pagination
adminRouter.get('/hwids', async (req: Request, res: Response) => {
    try {
        const db = getDatabase();
        const { hwid, launcher_install_uuid, player_name, account_type, ip_address, has_joined_with_this_hwid, from_date, to_date } = req.query as any;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

        const result = await searchHwidLogs(db, {
            hwid: hwid ? String(hwid) : undefined,
            launcher_install_uuid: launcher_install_uuid ? String(launcher_install_uuid) : undefined,
            player_name: player_name ? String(player_name) : undefined,
            account_type: account_type ? String(account_type) : undefined,
            ip_address: ip_address ? String(ip_address) : undefined,
            has_joined_with_this_hwid: typeof has_joined_with_this_hwid !== 'undefined' ? (has_joined_with_this_hwid === 'true' || has_joined_with_this_hwid === '1') : undefined,
            from_date: from_date ? String(from_date) : undefined,
            to_date: to_date ? String(to_date) : undefined,
            limit,
            offset
        });

        res.json({ total: result.total, logs: result.logs });
    } catch (error) {
        console.error('Error searching HWID logs:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch HWID logs' });
    }
});

// List all HWID bans
adminRouter.get('/hwids/bans', async (_req: Request, res: Response) => {
    try {
        const db = getDatabase();
        const bans = await listHwidBans(db);
        res.json({ bans });
    } catch (error) {
        console.error('Error listing HWID bans:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list bans' });
    }
});

// Create or upsert a ban for an HWID
adminRouter.post('/hwids/bans', async (req: Request, res: Response) => {
    try {
        const { hwid, reason } = req.body || {};
        if (!hwid) {
            res.status(400).json({ error: 'Bad Request', message: 'hwid is required' });
            return;
        }
        const db = getDatabase();
        const ban = await createHwidBan(db, String(hwid), String(reason || ''));
        res.status(201).json({ message: 'HWID banned', ban });
    } catch (error) {
        console.error('Error creating HWID ban:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create ban' });
    }
});

// Remove a ban for an HWID
adminRouter.delete('/hwids/bans/:hwid', async (req: Request, res: Response) => {
    try {
        const { hwid } = req.params;
        const db = getDatabase();
        const success = await deleteHwidBan(db, String(hwid));
        if (!success) {
            res.status(404).json({ error: 'Not Found', message: 'Ban not found' });
            return;
        }
        res.json({ message: 'Ban removed' });
    } catch (error) {
        console.error('Error deleting HWID ban:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete ban' });
    }
});

export default adminRouter; 