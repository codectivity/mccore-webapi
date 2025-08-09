import { Database } from 'sqlite';

/**
 * Database schema for the Minecraft Launcher Web API
 * MVP version with simple key-based authentication and launcher assets
 */

export interface LauncherAsset {
    id: number;
    client_id: string; // Public client identifier
    version: string; // Minecraft version (e.g., "1.20.1-forge")
    server: string;
    base_url: string;
    mods_manifest_url: string; // URL to fetch mods manifest (e.g., "mods_manifest.json")
    rp_manifest_url: string; // URL to fetch resource pack manifest (e.g., "rp_manifest.json")
    private_key: string; // Private key for signing manifests
    social_media: string; // JSON string of social media links
    created_at: string;
    updated_at: string;
}

export interface JavaAsset {
    id: number;
    source: string; // "Codectivity-cdn" or "custom"
    java_data: string; // JSON string of Java download links (only used when source is "custom")
    created_at: string;
    updated_at: string;
}

export interface ApiKey {
    id: number;
    key_hash: string; // Hashed API key
    name: string; // Optional name for the key
    is_active: boolean;
    created_at: string;
    last_used: string;
}

export interface News {
    id: number;
    client_id: string | null; // Optional client association; null => global
    title: string;
    description: string;
    image: string; // URL to the news image
    created_at: string;
    modified_at: string;
}

/**
 * Initialize database tables
 * Creates the basic schema for MVP functionality
 */
export async function initializeTables(db: Database): Promise<void> {
    try {
        // Create api_keys table for simple key-based authentication
        await db.exec(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_hash TEXT UNIQUE NOT NULL,
                name TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_used DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create launcher_assets table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS launcher_assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT UNIQUE NOT NULL,
                version TEXT NOT NULL,
                server TEXT NOT NULL,
                base_url TEXT NOT NULL,
                mods_manifest_url TEXT NOT NULL,
                rp_manifest_url TEXT NOT NULL,
                private_key TEXT NOT NULL,
                social_media TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create java_assets table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS java_assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL DEFAULT 'Codectivity-cdn',
                java_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create news table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS news (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                image TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                modified_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add client_id column to existing news table if it doesn't exist
        try {
            await db.exec(`
                ALTER TABLE news 
                ADD COLUMN client_id TEXT
            `);
        } catch (error) {
            // Column might already exist, ignore error
            console.log('client_id column for news might already exist or table is new');
        }

        // Add social_media column to existing launcher_assets table if it doesn't exist
        try {
            await db.exec(`
                ALTER TABLE launcher_assets 
                ADD COLUMN social_media TEXT DEFAULT '{}'
            `);
        } catch (error) {
            // Column might already exist, ignore error
            console.log('social_media column might already exist or table is new');
        }

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database tables:', error);
        throw error;
    }
} 