const { app, ipcRenderer } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const moment = require('moment');

// Database class
class Database {
    constructor() {
        this.db = null;
        this.dbPath = null;
        this.connected = false;
        this.initialize();
    }

    // Initialize database connection
    async initialize() {
        try {
            // Get database path from settings
            this.dbPath = await ipcRenderer.invoke('get-database-location');
            
            // If no custom path is set, use default location
            if (!this.dbPath) {
                const userDataPath = await ipcRenderer.invoke('get-app-data-path');
                this.dbPath = path.join(userDataPath, 'database.db');
            } else {
                // Make sure the directory exists
                const dbDir = path.dirname(this.dbPath);
                if (!fs.existsSync(dbDir)) {
                    fs.mkdirSync(dbDir, { recursive: true });
                }
                
                // Append filename if path is a directory
                const stats = fs.statSync(this.dbPath);
                if (stats.isDirectory()) {
                    this.dbPath = path.join(this.dbPath, 'database.db');
                }
            }
            
            // Connect to database
            await this.connect();
            
            // Create tables if they don't exist
            await this.createTables();
            
            // Check if tables need migration
            await this.migrateDatabase();
            
            this.connected = true;
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    // Connect to the database
    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Could not connect to database', err);
                    reject(err);
                } else {
                    console.log('Connected to database');
                    resolve();
                }
            });
        });
    }

    // Close the database connection
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                        reject(err);
                    } else {
                        console.log('Database connection closed');
                        this.connected = false;
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // Create tables if they don't exist
    createTables() {
        return new Promise((resolve, reject) => {
            // Enable foreign keys
            this.db.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) {
                    console.error('Error enabling foreign keys:', err);
                    reject(err);
                    return;
                }
                
                // Create tables
                const queries = [
                    // People table
                    `CREATE TABLE IF NOT EXISTS people (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        role TEXT,
                        costcenter TEXT,
                        phone TEXT,
                        email TEXT,
                        license_type TEXT,
                        status TEXT DEFAULT 'active',
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )`,
                    
                    // Vehicles table
                    `CREATE TABLE IF NOT EXISTS vehicles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        platenumber TEXT NOT NULL UNIQUE,
                        weight REAL,
                        packtime INTEGER,
                        type TEXT,
                        status TEXT DEFAULT 'active',
                        max_capacity REAL,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )`,
                    
                    // Addresses table
                    `CREATE TABLE IF NOT EXISTS addresses (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        district TEXT,
                        city TEXT,
                        postal_code TEXT,
                        notes TEXT,
                        delivery_restrictions TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )`,
                    
                    // Rounds table
                    `CREATE TABLE IF NOT EXISTS rounds (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date TEXT,
                        day TEXT,
                        köridő INTEGER,
                        addresses TEXT,
                        platenumber TEXT,
                        driver INTEGER,
                        addressCounts INTEGER,
                        OverallWeight REAL,
                        RoundStart TEXT,
                        RoundEnd TEXT,
                        Packtime INTEGER,
                        WorktimeStart TEXT,
                        WorktimeEnd TEXT,
                        SavedTime INTEGER,
                        DeltaDriveTime INTEGER,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (driver) REFERENCES people(id) ON DELETE SET NULL,
                        FOREIGN KEY (platenumber) REFERENCES vehicles(platenumber) ON DELETE SET NULL
                    )`,
                    
                    // VehicleAssignments table
                    `CREATE TABLE IF NOT EXISTS vehicle_assignments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        vehicle_id INTEGER NOT NULL,
                        driver_id INTEGER NOT NULL,
                        start_date TEXT NOT NULL,
                        end_date TEXT,
                        assignment_type TEXT DEFAULT 'regular',
                        approved_by TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
                        FOREIGN KEY (driver_id) REFERENCES people(id) ON DELETE CASCADE
                    )`,
                    
                    // TimeRecords table
                    `CREATE TABLE IF NOT EXISTS time_records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        driver_id INTEGER NOT NULL,
                        date TEXT NOT NULL,
                        check_in_time TEXT,
                        check_out_time TEXT,
                        total_hours REAL,
                        overtime_hours REAL,
                        notes TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (driver_id) REFERENCES people(id) ON DELETE CASCADE
                    )`,
                    
                    // StopEventsAlert table
                    `CREATE TABLE IF NOT EXISTS stop_events_alert (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        platenumber TEXT NOT NULL,
                        arrival_time TEXT NOT NULL,
                        standing_duration INTEGER,
                        ignition_status TEXT,
                        position TEXT,
                        important_point BOOLEAN DEFAULT 0,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (platenumber) REFERENCES vehicles(platenumber) ON DELETE CASCADE
                    )`,
                    
                    // Settings table
                    `CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )`,
                    
                    // Import history table
                    `CREATE TABLE IF NOT EXISTS import_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        import_type TEXT NOT NULL,
                        filename TEXT,
                        record_count INTEGER,
                        status TEXT,
                        error_message TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )`
                ];
                
                // Execute all table creation queries
                const promises = queries.map(query => {
                    return new Promise((innerResolve, innerReject) => {
                        this.db.run(query, (err) => {
                            if (err) {
                                console.error('Error creating table:', err);
                                innerReject(err);
                            } else {
                                innerResolve();
                            }
                        });
                    });
                });
                
                // Wait for all queries to complete
                Promise.all(promises)
                    .then(() => {
                        console.log('All tables created successfully');
                        resolve();
                    })
                    .catch(err => {
                        console.error('Error creating tables:', err);
                        reject(err);
                    });
            });
        });
    }

    // Database migration logic
    migrateDatabase() {
        return new Promise((resolve, reject) => {
            // Get current database version
            this.getSetting('db_version')
                .then(version => {
                    const currentVersion = version ? parseInt(version) : 0;
                    console.log('Current database version:', currentVersion);
                    
                    // Apply migrations based on version
                    switch (currentVersion) {
                        case 0:
                            // Initial version, set to 1
                            this.setSetting('db_version', '1')
                                .then(() => resolve())
                                .catch(err => reject(err));
                            break;
                        // Add future migrations here
                        default:
                            resolve();
                    }
                })
                .catch(err => {
                    console.error('Error getting database version:', err);
                    reject(err);
                });
        });
    }

    // Generic method to run a query
    run(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    console.error('Error running query:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Generic method to get all results
    all(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Error querying database:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Generic method to get a single result
    get(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    console.error('Error querying database:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Get a setting by key
    getSetting(key) {
        return new Promise((resolve, reject) => {
            this.get('SELECT value FROM settings WHERE key = ?', [key])
                .then(row => {
                    if (row) {
                        resolve(row.value);
                    } else {
                        resolve(null);
                    }
                })
                .catch(err => reject(err));
        });
    }

    // Set a setting
    setSetting(key, value) {
        return new Promise((resolve, reject) => {
            this.run(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                [key, value]
            )
                .then(result => resolve(result))
                .catch(err => reject(err));
        });
    }

    // Import data to a table
    importData(tableName, data, columnMapping) {
        return new Promise((resolve, reject) => {
            // Start a transaction
            this.db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    console.error('Error starting transaction:', err);
                    return reject(err);
                }
                
                // Prepare the columns and placeholders
                const columns = Object.values(columnMapping).filter(col => col);
                const placeholders = columns.map(() => '?').join(', ');
                
                // Create the insert query
                const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                
                // Prepare statement
                const stmt = this.db.prepare(query);
                
                let insertedCount = 0;
                let errors = [];
                
                // Insert each row
                data.forEach(row => {
                    try {
                        // Extract values based on column mapping
                        const values = columns.map(column => {
                            const excelColIndex = Object.keys(columnMapping).find(
                                key => columnMapping[key] === column
                            );
                            return row[excelColIndex] || null;
                        });
                        
                        // Run the statement
                        stmt.run(values, function(err) {
                            if (err) {
                                console.error('Error inserting row:', err);
                                errors.push({ row, error: err.message });
                            } else {
                                insertedCount++;
                            }
                        });
                    } catch (err) {
                        console.error('Error processing row:', err);
                        errors.push({ row, error: err.message });
                    }
                });
                
                // Finalize statement
                stmt.finalize();
                
                // Commit or rollback based on success
                if (errors.length === 0) {
                    this.db.run('COMMIT', (err) => {
                        if (err) {
                            console.error('Error committing transaction:', err);
                            this.db.run('ROLLBACK');
                            reject(err);
                        } else {
                            resolve({
                                success: true,
                                insertedCount,
                                errors: []
                            });
                        }
                    });
                } else {
                    this.db.run('ROLLBACK', (err) => {
                        if (err) {
                            console.error('Error rolling back transaction:', err);
                        }
                        resolve({
                            success: false,
                            insertedCount: 0,
                            errors
                        });
                    });
                }
            });
        });
    }

    // Record import history
    recordImport(importType, filename, recordCount, status, errorMessage = null) {
        return this.run(
            'INSERT INTO import_history (import_type, filename, record_count, status, error_message) VALUES (?, ?, ?, ?, ?)',
            [importType, filename, recordCount, status, errorMessage]
        );
    }

    // Get all drivers
    getDrivers() {
        return this.all('SELECT * FROM people WHERE role = "driver" ORDER BY name');
    }

    // Get active drivers
    getActiveDrivers() {
        return this.all('SELECT * FROM people WHERE role = "driver" AND status = "active" ORDER BY name');
    }

    // Get all vehicles
    getVehicles() {
        return this.all('SELECT * FROM vehicles ORDER BY platenumber');
    }

    // Get active vehicles
    getActiveVehicles() {
        return this.all('SELECT * FROM vehicles WHERE status = "active" ORDER BY platenumber');
    }

    // Get rounds for a specific date
    getRoundsByDate(date) {
        return this.all('SELECT * FROM rounds WHERE date = ? ORDER BY RoundStart', [date]);
    }

    // Get rounds for today
    getTodayRounds() {
        const today = moment().format('YYYY-MM-DD');
        return this.getRoundsByDate(today);
    }

    // Get active alerts
    getActiveAlerts() {
        return this.all(
            'SELECT * FROM stop_events_alert WHERE important_point = 1 ORDER BY arrival_time DESC'
        );
    }

    // Get recent imports
    getRecentImports(limit = 10) {
        return this.all(
            'SELECT * FROM import_history ORDER BY created_at DESC LIMIT ?',
            [limit]
        );
    }

    // Backup database
    backup(backupPath) {
        return new Promise((resolve, reject) => {
            // Create backup copy of database
            const backupFile = backupPath || `${this.dbPath}.backup-${moment().format('YYYYMMDD-HHmmss')}`;
            
            // Close existing connection
            this.close()
                .then(() => {
                    // Copy database file
                    fs.copyFile(this.dbPath, backupFile, (err) => {
                        if (err) {
                            console.error('Error backing up database:', err);
                            reject(err);
                        } else {
                            console.log('Database backed up successfully to:', backupFile);
                            
                            // Reconnect to database
                            this.connect()
                                .then(() => resolve(backupFile))
                                .catch(err => reject(err));
                        }
                    });
                })
                .catch(err => reject(err));
        });
    }

    // Reset database (drop and recreate all tables)
    resetDatabase() {
        return new Promise((resolve, reject) => {
            // Get all tables
            this.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                .then(tables => {
                    // Start a transaction
                    this.db.run('BEGIN TRANSACTION', (err) => {
                        if (err) {
                            console.error('Error starting transaction:', err);
                            return reject(err);
                        }
                        
                        // Drop each table
                        const dropPromises = tables.map(table => {
                            return new Promise((innerResolve, innerReject) => {
                                this.db.run(`DROP TABLE IF EXISTS ${table.name}`, (err) => {
                                    if (err) {
                                        console.error(`Error dropping table ${table.name}:`, err);
                                        innerReject(err);
                                    } else {
                                        innerResolve();
                                    }
                                });
                            });
                        });
                        
                        // Wait for all tables to be dropped
                        Promise.all(dropPromises)
                            .then(() => {
                                // Commit changes
                                this.db.run('COMMIT', (err) => {
                                    if (err) {
                                        console.error('Error committing transaction:', err);
                                        this.db.run('ROLLBACK');
                                        reject(err);
                                    } else {
                                        // Recreate tables
                                        this.createTables()
                                            .then(() => resolve())
                                            .catch(err => reject(err));
                                    }
                                });
                            })
                            .catch(err => {
                                this.db.run('ROLLBACK');
                                reject(err);
                            });
                    });
                })
                .catch(err => reject(err));
        });
    }
}

// Create and export a singleton instance
const database = new Database();
module.exports = database; 