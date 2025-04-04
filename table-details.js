const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(process.env.APPDATA, 'DriverAllerts', 'database', 'driverAlerts.db');
console.log(`Checking database at: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
    console.error(`Database file not found at ${dbPath}`);
    process.exit(1);
}

// Open the database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
    if (err) {
        console.error(`Error opening database: ${err.message}`);
        process.exit(1);
    }
    
    console.log('Connected to database successfully');
    
    // Get list of tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error(`Error listing tables: ${err.message}`);
            db.close();
            process.exit(1);
        }
        
        console.log('Tables in database:');
        
        // Process each table
        let processedTables = 0;
        tables.forEach(table => {
            // Skip the sqlite_sequence table
            if (table.name === 'sqlite_sequence') {
                processedTables++;
                if (processedTables === tables.length) {
                    db.close(() => console.log('Database connection closed'));
                }
                return;
            }
            
            console.log(`\n===== TABLE: ${table.name} =====`);
            
            // Get table schema
            db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
                if (err) {
                    console.error(`Error getting schema for ${table.name}: ${err.message}`);
                    return;
                }
                
                console.log('Columns:');
                columns.forEach(col => {
                    console.log(`  - ${col.name} (${col.type})${col.pk ? ' PRIMARY KEY' : ''}${col.notnull ? ' NOT NULL' : ''}`);
                });
                
                // Get foreign keys
                db.all(`PRAGMA foreign_key_list(${table.name})`, (err, foreignKeys) => {
                    if (err) {
                        console.error(`Error getting foreign keys for ${table.name}: ${err.message}`);
                        return;
                    }
                    
                    if (foreignKeys.length > 0) {
                        console.log('Foreign Keys:');
                        foreignKeys.forEach(fk => {
                            console.log(`  - ${fk.from} -> ${fk.table}.${fk.to}`);
                        });
                    }
                    
                    // Get row count
                    db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, result) => {
                        if (err) {
                            console.error(`Error getting count for ${table.name}: ${err.message}`);
                            return;
                        }
                        
                        console.log(`Row count: ${result.count}`);
                        
                        // If row count > 0, get a sample row
                        if (result.count > 0) {
                            db.get(`SELECT * FROM ${table.name} LIMIT 1`, (err, row) => {
                                if (err) {
                                    console.error(`Error getting sample from ${table.name}: ${err.message}`);
                                    return;
                                }
                                
                                console.log('Sample row:');
                                Object.entries(row).forEach(([key, value]) => {
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
                        
                        // Track processed tables to close connection when done
                        processedTables++;
                        if (processedTables === tables.length) {
                            setTimeout(() => {
                                db.close(() => console.log('\nDatabase connection closed'));
                            }, 100); // Small delay to ensure all output is printed
                        }
                    });
                });
            });
        });
    });
}); 