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
        tables.forEach(table => {
            console.log(`- ${table.name}`);
        });
        
        // Close the database
        db.close(() => {
            console.log('Database connection closed');
        });
    });
}); 