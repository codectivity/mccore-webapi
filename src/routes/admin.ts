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
    deleteNews
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
        const { client_id, version, server, base_url, mods_manifest_url, rp_manifest_url, private_key, social_media } = req.body;
        
        if (!client_id || !version || !server || !base_url || !mods_manifest_url || !rp_manifest_url || !private_key) {
            res.status(400).json({ 
                error: 'Bad Request', 
                message: 'client_id, version, server, base_url, mods_manifest_url, rp_manifest_url, and private_key are required' 
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
        const asset = await createLauncherAsset(db, {
            client_id,
            version,
            server,
            base_url,
            mods_manifest_url,
            rp_manifest_url,
            private_key: formattedPrivateKey,
            social_media: social_media ? JSON.stringify(social_media) : '{}'
        });
        
        res.status(201).json({
            message: 'Launcher asset created successfully',
            asset: {
                id: asset.id,
                client_id: asset.client_id,
                version: asset.version,
                server: asset.server,
                base_url: asset.base_url,
                mods_manifest_url: asset.mods_manifest_url,
                rp_manifest_url: asset.rp_manifest_url,
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
                version: asset.version,
                server: asset.server,
                base_url: asset.base_url,
                mods_manifest_url: asset.mods_manifest_url,
                rp_manifest_url: asset.rp_manifest_url,
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
                version: asset.version,
                server: asset.server,
                base_url: asset.base_url,
                mods_manifest_url: asset.mods_manifest_url,
                rp_manifest_url: asset.rp_manifest_url,
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

export default adminRouter; 