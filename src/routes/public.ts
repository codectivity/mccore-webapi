import { Router, Request, Response, NextFunction } from 'express';
import { request } from 'undici';
import { createSign } from 'crypto';
import { getDatabase } from '../database';
import { getLauncherAssetByClientId, getJavaAsset, getAllNews, getNewsById, formatVersionsForApi } from '../database/operations';
import { fetchModsManifest, fetchRpManifest } from '../utils/manifest';

const publicRouter = Router();

publicRouter.get('/assets/java', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const javaAsset = await getJavaAsset(db);
    
    if (!javaAsset) {
      // Default to Codectivity-cdn if no configuration exists
      try {
        const response = await request('https://api.sunrisenw.com/v1/public/assets/java');
        const data = await response.body.json();
        res.json(data);
      } catch (error) {
        console.error('Error fetching from Codectivity CDN:', error);
        res.status(500).json({ 
          error: 'Internal Server Error', 
          message: 'Failed to fetch Java assets from Codectivity CDN' 
        });
      }
      return;
    }
    
    if (javaAsset.source === 'Codectivity-cdn') {
      // Fetch from Codectivity CDN
      try {
        const response = await request('https://api.sunrisenw.com/v1/public/assets/java');
        const data = await response.body.json();
        res.json(data);
      } catch (error) {
        console.error('Error fetching from Codectivity CDN:', error);
        res.status(500).json({ 
          error: 'Internal Server Error', 
          message: 'Failed to fetch Java assets from Codectivity CDN' 
        });
      }
    } else if (javaAsset.source === 'custom') {
      // Return custom Java data
      if (!javaAsset.java_data) {
        res.status(500).json({ 
          error: 'Internal Server Error', 
          message: 'Custom Java data not configured' 
        });
        return;
      }
      
      try {
        const customData = JSON.parse(javaAsset.java_data);
        res.json(customData);
      } catch (error) {
        console.error('Error parsing custom Java data:', error);
        res.status(500).json({ 
          error: 'Internal Server Error', 
          message: 'Invalid custom Java data format' 
        });
      }
    } else {
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Invalid Java asset source configuration' 
      });
    }
  } catch (error) {
    console.error('Error fetching Java assets:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to fetch Java assets' 
    });
  }
});

publicRouter.post('/assets/launcher', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { client_id } = req.body;
    
    if (!client_id) {
      res.status(400).json({ 
        error: 'Bad Request', 
        message: 'client_id is required' 
      });
      return;
    }
    
    const db = getDatabase();
    const asset = await getLauncherAssetByClientId(db, client_id);
    
    if (!asset) {
      res.status(404).json({ 
        error: 'Not Found', 
        message: `Launcher asset for client_id ${client_id} not found` 
      });
      return;
    }
    
    // Fetch mods and resource pack manifests dynamically
    const [modsData, rpData] = await Promise.all([
      fetchModsManifest(asset.base_url, asset.mods_manifest_url, asset.private_key),
      fetchRpManifest(asset.base_url, asset.rp_manifest_url, asset.private_key)
    ]);
    
    // Parse social media data
    let socialMedia = {};
    try {
      if (asset.social_media) {
        socialMedia = JSON.parse(asset.social_media);
      }
    } catch (error) {
      console.error('Error parsing social media data:', error);
      socialMedia = {};
    }
    
    // Compute versions array (multi-version support)
    const versionsArray = formatVersionsForApi((asset as any).versions || '[]');
    const responseVersion = versionsArray.length > 0 ? versionsArray[0] : asset.version;

    // Return the launcher asset in the expected format with multi-version support
    res.json({
      base: asset.base_url,
      mods: {
        files: modsData.files,
        signature: modsData.signature
      },
      rp: {
        files: rpData.files,
        signature: rpData.signature
      },
      version: responseVersion,
      versions: versionsArray,
      server: asset.server,
      social_media: socialMedia
    });
  } catch (error) {
    console.error('Error fetching launcher asset:', error);
    
    // Check if it's a database schema error (missing column)
    if (error instanceof Error && error.message.includes('no such column')) {
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Database schema mismatch. Please restart the server to update the database schema.' 
      });
      return;
    }
    
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to fetch launcher asset' 
    });
  }
});

publicRouter.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'API Test' });
});

/**
 * Public News Routes
 */

// Get all news articles (public). Optional query: client_id to filter per launcher client
publicRouter.get('/news', async (req: Request, res: Response) => {
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

// Get news article by ID (public)
publicRouter.get('/news/:id', async (req: Request, res: Response) => {
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

export default publicRouter;