import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../database';
import { validateApiKey } from '../database/operations';

/**
 * Middleware to validate API key authentication
 * Expects API key in Authorization header: "Bearer YOUR_API_KEY"
 */
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'API key required. Use Authorization: Bearer YOUR_API_KEY' 
            });
        }
        
        const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
        const db = getDatabase();
        const validKey = await validateApiKey(db, apiKey);
        
        if (!validKey) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid or inactive API key' 
            });
        }
        
        // Add the validated API key info to the request for potential use
        (req as any).apiKey = validKey;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Authentication failed' 
        });
    }
}

/**
 * Optional authentication middleware
 * Continues even if no API key is provided
 */
export async function optionalApiKeyAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const apiKey = authHeader.substring(7);
            const db = getDatabase();
            const validKey = await validateApiKey(db, apiKey);
            
            if (validKey) {
                (req as any).apiKey = validKey;
            }
        }
        
        next();
    } catch (error) {
        console.error('Optional authentication error:', error);
        // Continue without authentication
        next();
    }
} 