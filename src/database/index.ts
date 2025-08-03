import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { initializeTables } from './schema';

let db: Database | null = null;

/**
 * Migrate database schema to latest version
 * Handles schema changes between versions
 */
async function migrateDatabase(db: Database): Promise<void> {
    try {
        // Check if client_id column exists in launcher_assets table
        const tableInfo = await db.all("PRAGMA table_info(launcher_assets)");
        const hasClientId = tableInfo.some((col: any) => col.name === 'client_id');
        
        if (!hasClientId) {
            console.log('Migrating database schema...');
            
            // Check if table has data
            const existingData = await db.all("SELECT * FROM launcher_assets LIMIT 1");
            const hasData = existingData.length > 0;
            
            if (hasData) {
                console.log('Table has existing data, recreating with new schema...');
                
                // Create temporary table with new schema
                await db.exec(`
                    CREATE TABLE launcher_assets_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        client_id TEXT UNIQUE NOT NULL,
                        version TEXT NOT NULL,
                        server TEXT NOT NULL,
                        base_url TEXT NOT NULL,
                        mods_manifest_url TEXT NOT NULL,
                        rp_manifest_url TEXT NOT NULL,
                        private_key TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                // Copy existing data with default values for new columns
                await db.exec(`
                    INSERT INTO launcher_assets_new (id, client_id, version, server, base_url, mods_manifest_url, rp_manifest_url, private_key, created_at, updated_at)
                    SELECT 
                        id, 
                        'legacy_' || id as client_id, 
                        version, 
                        server, 
                        base_url, 
                        'mods_manifest.json' as mods_manifest_url, 
                        'rp_manifest.json' as rp_manifest_url, 
                        '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...\n-----END PRIVATE KEY-----' as private_key,
                        created_at, 
                        updated_at
                    FROM launcher_assets
                `);
                
                // Drop old table and rename new one
                await db.exec("DROP TABLE launcher_assets");
                await db.exec("ALTER TABLE launcher_assets_new RENAME TO launcher_assets");
                
                console.log('Data migrated successfully. Please update client_id values and add proper manifest URLs and private key.');
            } else {
                // No data, just drop and recreate
                await db.exec("DROP TABLE launcher_assets");
                await db.exec(`
                    CREATE TABLE launcher_assets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        client_id TEXT UNIQUE NOT NULL,
                        version TEXT NOT NULL,
                        server TEXT NOT NULL,
                        base_url TEXT NOT NULL,
                        mods_manifest_url TEXT NOT NULL,
                        rp_manifest_url TEXT NOT NULL,
                        private_key TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
            }
            
            console.log('Database migration completed successfully');
        }
    } catch (error) {
        console.error('Error during database migration:', error);
        throw error;
    }
}

/**
 * Initialize the database connection
 * Opens SQLite database and creates tables if they don't exist
 */
export async function initializeDatabase(): Promise<Database> {
    if (db) {
        return db;
    }

    try {
        db = await open({
            filename: './database.db',
            driver: sqlite3.Database
        });

        // Initialize database tables
        await initializeTables(db);
        
        // Run migrations
        await migrateDatabase(db);

        console.log('Database initialized successfully');
        return db;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

/**
 * Get the database instance
 * Returns the initialized database or throws an error if not initialized
 */
export function getDatabase(): Database {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.close();
        db = null;
        console.log('Database connection closed');
    }
} 