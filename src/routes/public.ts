import { Router, Request, Response, NextFunction } from 'express';
import { request } from 'undici';
import { createSign } from 'crypto';
import { getDatabase } from '../database';
import { getLauncherAssetByClientId, getJavaAsset, getAllNews, getNewsById, formatVersionsForApi, createHwidLog, isHwidBanned, markHwidJoined, isHwidJoined } from '../database/operations';
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
    
    // Decide which base and manifest URLs to use per requested version (if provided) or default
    const requestedVersion = (req.body?.version as string | undefined) || undefined;
    let baseUrl = asset.base_url;
    let modsManifestUrl = asset.mods_manifest_url;
    let rpManifestUrl = asset.rp_manifest_url;
    try {
      const vc = (asset as any).version_configs ? JSON.parse((asset as any).version_configs) as Record<string, { base_url: string; mods_manifest_url: string; rp_manifest_url: string; }> : null;
      const useVersion = requestedVersion || undefined;
      if (vc && useVersion && vc[useVersion]) {
        baseUrl = vc[useVersion].base_url || baseUrl;
        modsManifestUrl = vc[useVersion].mods_manifest_url || modsManifestUrl;
        rpManifestUrl = vc[useVersion].rp_manifest_url || rpManifestUrl;
      }
    } catch {}

    // Fetch mods and resource pack manifests dynamically from resolved URLs
    const [modsData, rpData] = await Promise.all([
      fetchModsManifest(baseUrl, modsManifestUrl, asset.private_key),
      fetchRpManifest(baseUrl, rpManifestUrl, asset.private_key)
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

    // Return launcher asset with single version field as an array (merged)
    res.json({
      base: baseUrl,
      mods: {
        files: modsData.files,
        signature: modsData.signature
      },
      rp: {
        files: rpData.files,
        signature: rpData.signature
      },
      version: versionsArray.length > 0 ? versionsArray : [asset.version],
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
 * Public HWID Endpoints
 */

// Submit HWID information from launcher (public)
publicRouter.post('/hwid', async (req: Request, res: Response) => {
  try {
    const { hwid, launcher_install_uuid, player_name, account_type, login_date, ip_address, has_joined_with_this_hwid } = req.body || {};

    if (!hwid || !launcher_install_uuid || !player_name || !account_type) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'hwid, launcher_install_uuid, player_name, and account_type are required'
      });
      return;
    }

    // Validate login_date or default to now
    const loginDateIso = login_date ? new Date(login_date).toISOString() : new Date().toISOString();
    if (Number.isNaN(Date.parse(loginDateIso))) {
      res.status(400).json({ error: 'Bad Request', message: 'login_date must be a valid date' });
      return;
    }

    const db = getDatabase();
    // If HWID previously marked as joined, force the flag true on the log
    const joined = await isHwidJoined(db, String(hwid));
    const log = await createHwidLog(db, {
      hwid: String(hwid),
      launcher_install_uuid: String(launcher_install_uuid),
      player_name: String(player_name),
      account_type: String(account_type),
      login_date: loginDateIso,
      ip_address: ip_address || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '',
      has_joined_with_this_hwid: joined || !!has_joined_with_this_hwid
    });

    res.status(201).json({
      message: 'HWID logged',
      id: log.id
    });
  } catch (error) {
    console.error('Error logging HWID:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to log HWID' });
  }
});

// Public endpoint to irreversibly mark an HWID as joined
publicRouter.post('/hwid/joined', async (req: Request, res: Response) => {
  try {
    const { hwid } = req.body || {};
    if (!hwid) {
      res.status(400).json({ error: 'Bad Request', message: 'hwid is required' });
      return;
    }
    const db = getDatabase();
    const row = await markHwidJoined(db, String(hwid));
    res.status(201).json({ message: 'HWID marked as joined', hwid: row.hwid, created_at: row.created_at });
  } catch (error) {
    console.error('Error marking HWID joined:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to mark joined' });
  }
});

// Public endpoint to check if an HWID is banned; returns true/false
publicRouter.get('/check-hwid', async (req: Request, res: Response) => {
  try {
    const hwid = (req.query.hwid as string) || (req.body?.hwid as string);
    if (!hwid) {
      res.status(400).json({ error: 'Bad Request', message: 'hwid is required' });
      return;
    }
    const db = getDatabase();
    const banned = await isHwidBanned(db, hwid);
    res.json(banned);
  } catch (error) {
    console.error('Error checking HWID ban:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to check HWID' });
  }
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