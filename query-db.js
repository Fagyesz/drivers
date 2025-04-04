const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('Database inspection tool starting...');

// Try to find the database file
try {
    // List of possible database locations
    const possibleLocations = [
        // Standard Electron app data locations
        path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'DriverAllerts', 'database', 'driverAlerts.db'),
        path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Electron', 'database', 'driverAlerts.db'),
        // Current directory and subdirectories
        path.join(process.cwd(), 'database', 'driverAlerts.db'),
        path.join(process.cwd(), 'driverAlerts.db'),
        path.join(process.cwd(), 'data', 'driverAlerts.db'),
        // Project directory variations
        path.join(process.cwd(), '..', 'database', 'driverAlerts.db'),
        path.join(process.cwd(), '..', 'data', 'driverAlerts.db'),
        // Include both case variations
        path.join(process.cwd(), 'database', 'DriverAlerts.db'),
        path.join(process.cwd(), 'DriverAlerts.db'),
        // User directory
        path.join(os.homedir(), 'DriverAllerts', 'database', 'driverAlerts.db')
    ];
    
    // Try to find the database file
    let dbPath = null;
    for (const location of possibleLocations) {
        console.log(`Checking location: ${location}`);
        if (fs.existsSync(location)) {
            console.log(`Found database at: ${location}`);
            dbPath = location;
            break;
        }
    }
    
    if (!dbPath) {
        // Create a test database in memory for demonstration
        console.log('Database file not found. Creating an in-memory database for testing...');
        
        const db = new sqlite3.Database(':memory:', (err) => {
            if (err) {
                console.error(`Error creating in-memory database: ${err.message}`);
                process.exit(1);
            }
            
            console.log('Created in-memory database');
            
            // Create test tables
            db.serialize(() => {
                db.run('CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT, role TEXT)');
                db.run('CREATE TABLE vehicles (id INTEGER PRIMARY KEY, platenumber TEXT, type TEXT)');
                db.run('CREATE TABLE rounds (id INTEGER PRIMARY KEY, date TEXT, driver_id INTEGER)');
                
                // Insert some test data
                db.run("INSERT INTO people VALUES (1, 'John Doe', 'Driver')");
                db.run("INSERT INTO people VALUES (2, 'Jane Smith', 'Driver')");
                db.run("INSERT INTO vehicles VALUES (1, 'ABC123', 'Truck')");
                db.run("INSERT INTO rounds VALUES (1, '2023-04-03', 1)");
                
                console.log('Created test tables with sample data');
                
                // Analyze the database
                analyzeDatabase(db);
            });
        });
    } else {
        // Open the found database
        openDatabase(dbPath);
    }
} catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
}

function openDatabase(dbPath) {
    // Open database connection
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(`Error opening database: ${err.message}`);
            process.exit(1);
        }
        console.log('Connected to the database successfully');
        
        // Analyze the database
        analyzeDatabase(db);
    });
}

function analyzeDatabase(db) {
    // Get list of tables
    db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, tables) => {
        if (err) {
            console.error(`Error getting tables: ${err.message}`);
            db.close();
            process.exit(1);
        }
        
        console.log('\n=== Database Tables ===');
        if (tables.length === 0) {
            console.log('No tables found in the database.');
            db.close();
            return;
        }
        
        tables.forEach(table => {
            console.log(`- ${table.name}`);
        });
        
        // Function to get table structure
        const getTableInfo = (tableName) => {
            return new Promise((resolve, reject) => {
                db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ tableName, columns });
                });
            });
        };
        
        // Function to get table count
        const getTableCount = (tableName) => {
            return new Promise((resolve, reject) => {
                db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ tableName, count: result.count });
                });
            });
        };
        
        // Get all table details
        Promise.all(tables.map(table => getTableInfo(table.name)))
            .then(tableInfos => {
                console.log('\n=== Table Structures ===');
                tableInfos.forEach(info => {
                    console.log(`\nTable: ${info.tableName}`);
                    console.log('Columns:');
                    info.columns.forEach(col => {
                        console.log(`  ${col.name} (${col.type})${col.pk ? ' PRIMARY KEY' : ''}${col.notnull ? ' NOT NULL' : ''}`);
                    });
                });
                
                // Get record counts for each table
                return Promise.all(tables.map(table => getTableCount(table.name))).then(counts => {
                    return { tableInfos, counts };
                });
            })
            .then(({ tableInfos, counts }) => {
                console.log('\n=== Record Counts ===');
                counts.forEach(info => {
                    console.log(`${info.tableName}: ${info.count} records`);
                });
                
                // Get sample data from each table (limit to tables with data)
                const tablePromises = [];
                counts.forEach(countInfo => {
                    if (countInfo.count > 0 && countInfo.tableName !== 'sqlite_sequence') {
                        tablePromises.push(
                            new Promise((resolve, reject) => {
                                db.all(`SELECT * FROM ${countInfo.tableName} LIMIT 5`, [], (err, rows) => {
                                    if (err) {
                                        reject(err);
                                        return;
                                    }
                                    resolve({ tableName: countInfo.tableName, rows });
                                });
                            })
                        );
                    }
                });
                
                return Promise.all(tablePromises);
            })
            .then(tableData => {
                console.log('\n=== Sample Data ===');
                tableData.forEach(data => {
                    console.log(`\nTable: ${data.tableName} (showing up to 5 rows)`);
                    if (data.rows.length === 0) {
                        console.log('  No data');
                    } else {
                        data.rows.forEach((row, idx) => {
                            console.log(`  Row ${idx + 1}:`);
                            Object.entries(row).forEach(([key, value]) => {
                                // Format the value based on its type
                                let displayValue = value;
                                if (value === null) {
                                    displayValue = 'NULL';
                                } else if (typeof value === 'string' && value.length > 50) {
                                    displayValue = value.substring(0, 47) + '...';
                                }
                                console.log(`    ${key}: ${displayValue}`);
                            });
                        });
                    }
                });
                
                // Get database connection info
                console.log('\n=== Database Connection Info ===');
                console.log(`Database file: ${db.filename || 'In-memory database'}`);
                
                return new Promise((resolve, reject) => {
                    db.get('PRAGMA journal_mode', [], (err, result) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(result);
                    });
                });
            })
            .then(journalMode => {
                if (journalMode) console.log(`Journal mode: ${journalMode.journal_mode}`);
                
                return new Promise((resolve, reject) => {
                    db.get('PRAGMA foreign_keys', [], (err, result) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(result);
                    });
                });
            })
            .then(foreignKeys => {
                if (foreignKeys) console.log(`Foreign keys: ${foreignKeys.foreign_keys === 1 ? 'ON' : 'OFF'}`);
                
                // Close database connection
                db.close(() => {
                    console.log('\nDatabase connection closed');
                });
            })
            .catch(err => {
                console.error(`Error analyzing database: ${err.message}`);
                db.close();
                process.exit(1);
            });
    });
} 