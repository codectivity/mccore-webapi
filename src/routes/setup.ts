import { Router, Request, Response } from 'express';
import { getDatabase } from '../database';
import { getAllApiKeys, createApiKey } from '../database/operations';

const setupRouter = Router();

/**
 * Setup endpoint for initial API key creation
 * Only works when no API keys exist in the system
 */

// Create the first API key (no authentication required)
setupRouter.post('/create-first-key', async (req: Request, res: Response) => {
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
        
        // Check if any API keys already exist
        const existingKeys = await getAllApiKeys(db);
        
        if (existingKeys.length > 0) {
            res.status(403).json({ 
                error: 'Forbidden', 
                message: 'API keys already exist. Use admin endpoints with authentication.' 
            });
            return;
        }
        
        // Create the first API key
        const newKey = await createApiKey(db, key, name);
        
        res.status(201).json({
            message: 'First API key created successfully. Use this key for admin authentication.',
            key: {
                id: newKey.id,
                name: newKey.name,
                created_at: newKey.created_at
            },
            note: 'Store this API key securely. You will need it to access admin endpoints.'
        });
    } catch (error) {
        console.error('Error creating first API key:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to create API key' 
        });
    }
});

// Check if setup is needed
setupRouter.get('/status', async (_req: Request, res: Response) => {
    try {
        const db = getDatabase();
        const existingKeys = await getAllApiKeys(db);
        
        res.json({
            setup_needed: existingKeys.length === 0,
            existing_keys_count: existingKeys.length
        });
    } catch (error) {
        console.error('Error checking setup status:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to check setup status' 
        });
    }
});

export default setupRouter; 