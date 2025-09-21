import { Database } from 'sqlite';

/**
 * Database schema for the Minecraft Launcher Web API
 * MVP version with simple key-based authentication and launcher assets
 */

export interface LauncherAsset {
    id: number;
    client_id: string; // Public client identifier
    version: string; // Minecraft version (e.g., "1.20.1-forge")
    versions?: string; // JSON string array of versions (e.g., ["1.20.1-forge"]) - optional for backward compatibility
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

export interface HwidLog {
    id: number;
    hwid: string;
    launcher_install_uuid: string;
    player_name: string;
    account_type: string;
    login_date: string; // ISO datetime
    ip_address: string;
    created_at: string;
}

export interface HwidBan {
    id: number;
    hwid: string;
    reason: string;
    created_at: string;
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
                versions TEXT,
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

        // Create hwid_logs table (if a legacy table exists without all columns, we patch below)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS hwid_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hwid TEXT NOT NULL,
                launcher_install_uuid TEXT NOT NULL,
                player_name TEXT NOT NULL,
                account_type TEXT NOT NULL,
                login_date DATETIME NOT NULL,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ensure legacy hwid_logs tables have required columns
        try {
            const columns: any[] = await db.all("PRAGMA table_info(hwid_logs)");
            const colNames = new Set(columns.map((c: any) => c.name));
            const hasBadUserId = columns.some((c: any) => c.name === 'user_id' && c.notnull === 1);
            if (!colNames.has('launcher_install_uuid')) {
                // Add column for legacy DBs; cannot enforce NOT NULL on existing rows
                await db.exec(`ALTER TABLE hwid_logs ADD COLUMN launcher_install_uuid TEXT`);
            }
            if (!colNames.has('player_name')) {
                await db.exec(`ALTER TABLE hwid_logs ADD COLUMN player_name TEXT`);
            }
            if (!colNames.has('account_type')) {
                await db.exec(`ALTER TABLE hwid_logs ADD COLUMN account_type TEXT`);
            }
            if (!colNames.has('login_date')) {
                await db.exec(`ALTER TABLE hwid_logs ADD COLUMN login_date DATETIME`);
            }
            if (!colNames.has('ip_address')) {
                await db.exec(`ALTER TABLE hwid_logs ADD COLUMN ip_address TEXT`);
            }
            if (!colNames.has('created_at')) {
                await db.exec(`ALTER TABLE hwid_logs ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
            }

            // Detect legacy unique constraints on columns that must allow duplicates (e.g., hwid)
            let hasBadUnique = false;
            try {
                const idxList: any[] = await db.all("PRAGMA index_list(hwid_logs)");
                for (const idx of idxList) {
                    if (idx.unique === 1) {
                        const idxName = String(idx.name).replace(/'/g, "''");
                        const info: any[] = await db.all(`PRAGMA index_info('${idxName}')`);
                        const cols = info.map((i: any) => i.name);
                        // If index is unique on a single data column that should allow duplicates, mark as bad
                        if (cols.length === 1 && ['hwid', 'launcher_install_uuid', 'player_name', 'account_type', 'login_date', 'ip_address'].includes(cols[0])) {
                            hasBadUnique = true;
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('Could not inspect hwid_logs indexes:', e);
            }

            // If legacy NOT NULL user_id or bad unique constraints exist, rebuild the table to remove them
            if (hasBadUserId || hasBadUnique) {
                // Create new table with the desired schema
                await db.exec(`
                    CREATE TABLE hwid_logs_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        hwid TEXT NOT NULL,
                        launcher_install_uuid TEXT,
                        player_name TEXT,
                        account_type TEXT,
                        login_date DATETIME,
                        ip_address TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Build dynamic SELECT to handle missing columns safely
                const sel_hwid = colNames.has('hwid') ? 'hwid' : "'' AS hwid";
                const sel_launcher = colNames.has('launcher_install_uuid') ? 'launcher_install_uuid' : "'' AS launcher_install_uuid";
                const sel_player = colNames.has('player_name') ? 'player_name' : "'' AS player_name";
                const sel_account = colNames.has('account_type') ? 'account_type' : "'' AS account_type";
                const sel_login = colNames.has('login_date') ? 'login_date' : (colNames.has('created_at') ? 'created_at AS login_date' : "datetime('now') AS login_date");
                const sel_ip = colNames.has('ip_address') ? 'ip_address' : "'' AS ip_address";
                const sel_created = colNames.has('created_at') ? 'created_at' : "datetime('now') AS created_at";

                await db.exec(`
                    INSERT INTO hwid_logs_new (hwid, launcher_install_uuid, player_name, account_type, login_date, ip_address, created_at)
                    SELECT ${sel_hwid}, ${sel_launcher}, ${sel_player}, ${sel_account}, ${sel_login}, ${sel_ip}, ${sel_created}
                    FROM hwid_logs
                `);

                await db.exec('DROP TABLE hwid_logs');
                await db.exec('ALTER TABLE hwid_logs_new RENAME TO hwid_logs');
            }
        } catch (e) {
            console.warn('Warning while ensuring hwid_logs columns:', e);
        }

        // Indexes for hwid_logs
        try { await db.exec(`CREATE INDEX IF NOT EXISTS idx_hwid_logs_hwid ON hwid_logs(hwid);`); } catch (e) { console.warn('Index create warning (hwid):', e); }
        try { await db.exec(`CREATE INDEX IF NOT EXISTS idx_hwid_logs_launcher_uuid ON hwid_logs(launcher_install_uuid);`); } catch (e) { console.warn('Index create warning (launcher_install_uuid):', e); }
        try { await db.exec(`CREATE INDEX IF NOT EXISTS idx_hwid_logs_login_date ON hwid_logs(login_date);`); } catch (e) { console.warn('Index create warning (login_date):', e); }
        try { await db.exec(`CREATE INDEX IF NOT EXISTS idx_hwid_logs_ip ON hwid_logs(ip_address);`); } catch (e) { console.warn('Index create warning (ip_address):', e); }

        // Create hwid_bans table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS hwid_bans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hwid TEXT UNIQUE NOT NULL,
                reason TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_hwid_bans_hwid ON hwid_bans(hwid);
        `);

        // Ensure legacy hwid_bans tables are compatible (e.g., old NOT NULL user_id)
        try {
            const banCols: any[] = await db.all("PRAGMA table_info(hwid_bans)");
            const banColNames = new Set(banCols.map((c: any) => c.name));
            const hasBadUserIdBan = banCols.some((c: any) => c.name === 'user_id' && c.notnull === 1);

            if (!banColNames.has('reason')) {
                await db.exec(`ALTER TABLE hwid_bans ADD COLUMN reason TEXT DEFAULT ''`);
            }
            if (!banColNames.has('created_at')) {
                await db.exec(`ALTER TABLE hwid_bans ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
            }

            if (hasBadUserIdBan) {
                // Rebuild bans table without user_id NOT NULL
                await db.exec(`
                    CREATE TABLE hwid_bans_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        hwid TEXT UNIQUE NOT NULL,
                        reason TEXT DEFAULT '',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                const sel_hwid = banColNames.has('hwid') ? 'hwid' : "'' AS hwid";
                const sel_reason = banColNames.has('reason') ? 'reason' : "'' AS reason";
                const sel_created = banColNames.has('created_at') ? 'created_at' : "datetime('now') AS created_at";

                await db.exec(`
                    INSERT INTO hwid_bans_new (hwid, reason, created_at)
                    SELECT ${sel_hwid}, ${sel_reason}, ${sel_created} FROM hwid_bans
                `);

                await db.exec('DROP TABLE hwid_bans');
                await db.exec('ALTER TABLE hwid_bans_new RENAME TO hwid_bans');
                await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_hwid_bans_hwid ON hwid_bans(hwid)');
            }
        } catch (e) {
            console.warn('Warning while ensuring hwid_bans columns:', e);
        }

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

        // Add versions column to existing launcher_assets table if it doesn't exist
        try {
            await db.exec(`
                ALTER TABLE launcher_assets 
                ADD COLUMN versions TEXT
            `);
        } catch (error) {
            // Column might already exist, ignore error
            console.log('versions column might already exist or table is new');
        }

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database tables:', error);
        throw error;
    }
} 