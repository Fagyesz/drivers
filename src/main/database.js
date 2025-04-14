/**
 * Database Handler
 * 
 * Provides a clean and robust API for database operations.
 * Uses sqlite3 for database access.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { DB_TABLES } = require('../shared/constants');
const logger = require('../renderer/utils/logger').createLogger('Database');

// Database connection instance
let db = null;

// Default database path
const DEFAULT_DB_PATH = path.join(__dirname, '../../data/driver-allerts.db');

/**
 * Initialize the database
 * @param {string} dbPath - Path to the database file
 * @returns {Promise<void>}
 */
function initDatabase(dbPath = DEFAULT_DB_PATH) {
  return new Promise((resolve, reject) => {
    logger.info('Initializing database', { dbPath });
    
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Create or open database
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Database initialization failed', { error: err.message });
        return reject(err);
      }
      
      logger.info('Database connection established');
      
      // Set pragmas for better performance
      db.run('PRAGMA journal_mode = WAL;');
      db.run('PRAGMA synchronous = NORMAL;');
      
      // Initialize tables
      initTables()
        .then(() => {
          logger.info('Database tables initialized');
          resolve();
        })
        .catch((error) => {
          logger.error('Error initializing tables', { error: error.message });
          reject(error);
        });
    });
  });
}

/**
 * Initialize database tables
 * @returns {Promise<void>}
 */
function initTables() {
  return new Promise((resolve, reject) => {
    logger.debug('Initializing database tables');
    
    // Create tables if they don't exist
    const createPeopleTable = `
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.PEOPLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        job_title TEXT,
        cost_center TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    const createVehiclesTable = `
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.VEHICLES} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT NOT NULL UNIQUE,
        model TEXT,
        vehicle_type TEXT,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    const createRoundsTable = `
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.ROUNDS} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER,
        person_id INTEGER,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES ${DB_TABLES.VEHICLES} (id),
        FOREIGN KEY (person_id) REFERENCES ${DB_TABLES.PEOPLE} (id)
      );
    `;
    
    const createAlertsTable = `
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.ALERTS} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT NOT NULL,
        alert_date TIMESTAMP,
        alert_type TEXT,
        description TEXT,
        status TEXT DEFAULT 'pending',
        is_important INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    const createLogsTable = `
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.LOGS} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        module TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data TEXT
      );
    `;
    
    // Create indices for better performance
    const createIndices = `
      CREATE INDEX IF NOT EXISTS idx_people_name ON ${DB_TABLES.PEOPLE} (name);
      CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON ${DB_TABLES.VEHICLES} (plate_number);
      CREATE INDEX IF NOT EXISTS idx_rounds_vehicle ON ${DB_TABLES.ROUNDS} (vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_rounds_person ON ${DB_TABLES.ROUNDS} (person_id);
      CREATE INDEX IF NOT EXISTS idx_rounds_status ON ${DB_TABLES.ROUNDS} (status);
      CREATE INDEX IF NOT EXISTS idx_alerts_plate ON ${DB_TABLES.ALERTS} (plate_number);
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON ${DB_TABLES.ALERTS} (status);
      CREATE INDEX IF NOT EXISTS idx_alerts_important ON ${DB_TABLES.ALERTS} (is_important);
    `;
    
    // Execute all create statements in a transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      db.run(createPeopleTable, (err) => {
        if (err) {
          logger.error('Error creating people table', { error: err.message });
          db.run('ROLLBACK');
          return reject(err);
        }
      });
      
      db.run(createVehiclesTable, (err) => {
        if (err) {
          logger.error('Error creating vehicles table', { error: err.message });
          db.run('ROLLBACK');
          return reject(err);
        }
      });
      
      db.run(createRoundsTable, (err) => {
        if (err) {
          logger.error('Error creating rounds table', { error: err.message });
          db.run('ROLLBACK');
          return reject(err);
        }
      });
      
      db.run(createAlertsTable, (err) => {
        if (err) {
          logger.error('Error creating alerts table', { error: err.message });
          db.run('ROLLBACK');
          return reject(err);
        }
      });
      
      db.run(createLogsTable, (err) => {
        if (err) {
          logger.error('Error creating logs table', { error: err.message });
          db.run('ROLLBACK');
          return reject(err);
        }
      });
      
      db.run(createIndices, (err) => {
        if (err) {
          logger.error('Error creating indices', { error: err.message });
          db.run('ROLLBACK');
          return reject(err);
        }
        
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            logger.error('Error committing transaction', { error: commitErr.message });
            return reject(commitErr);
          }
          resolve();
        });
      });
    });
  });
}

/**
 * Close the database connection
 * @returns {Promise<void>}
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      return resolve();
    }
    
    logger.info('Closing database connection');
    db.close((err) => {
      if (err) {
        logger.error('Error closing database', { error: err.message });
        return reject(err);
      }
      
      db = null;
      logger.info('Database connection closed');
      resolve();
    });
  });
}

/**
 * Run a SQL query with parameters
 * @param {string} sql - SQL query
 * @param {Array|Object} params - Parameters for the query
 * @returns {Promise<void>}
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        logger.error('Error running SQL', { sql, error: err.message });
        return reject(err);
      }
      
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Get a single row from a SQL query
 * @param {string} sql - SQL query
 * @param {Array|Object} params - Parameters for the query
 * @returns {Promise<Object>} Row object or null if not found
 */
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        logger.error('Error getting row', { sql, error: err.message });
        return reject(err);
      }
      
      resolve(row || null);
    });
  });
}

/**
 * Get all rows from a SQL query
 * @param {string} sql - SQL query
 * @param {Array|Object} params - Parameters for the query
 * @returns {Promise<Array>} Array of row objects
 */
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        logger.error('Error getting all rows', { sql, error: err.message });
        return reject(err);
      }
      
      resolve(rows || []);
    });
  });
}

/**
 * Execute SQL in a transaction
 * @param {Function} callback - Function that executes SQL in a transaction
 * @returns {Promise<any>} Result of the transaction
 */
async function transaction(callback) {
  try {
    await run('BEGIN TRANSACTION');
    const result = await callback();
    await run('COMMIT');
    return result;
  } catch (error) {
    logger.error('Transaction failed, rolling back', { error: error.message });
    await run('ROLLBACK');
    throw error;
  }
}

// === People Methods ===

/**
 * Get all people
 * @returns {Promise<Array>} Array of people
 */
async function getPeople() {
  const sql = `SELECT * FROM ${DB_TABLES.PEOPLE} ORDER BY name`;
  return all(sql);
}

/**
 * Get a person by ID
 * @param {number} id - Person ID
 * @returns {Promise<Object>} Person object or null
 */
async function getPersonById(id) {
  const sql = `SELECT * FROM ${DB_TABLES.PEOPLE} WHERE id = ?`;
  return get(sql, [id]);
}

/**
 * Create a new person
 * @param {Object} person - Person object
 * @returns {Promise<Object>} Result object with lastID
 */
async function createPerson(person) {
  const sql = `
    INSERT INTO ${DB_TABLES.PEOPLE} 
    (name, email, phone, job_title, cost_center)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  const params = [
    person.name,
    person.email || null,
    person.phone || null,
    person.job_title || null,
    person.cost_center || null
  ];
  
  return run(sql, params);
}

// === Vehicles Methods ===

/**
 * Get all vehicles
 * @returns {Promise<Array>} Array of vehicles
 */
async function getVehicles() {
  const sql = `SELECT * FROM ${DB_TABLES.VEHICLES} ORDER BY plate_number`;
  return all(sql);
}

/**
 * Get a vehicle by ID
 * @param {number} id - Vehicle ID
 * @returns {Promise<Object>} Vehicle object or null
 */
async function getVehicleById(id) {
  const sql = `SELECT * FROM ${DB_TABLES.VEHICLES} WHERE id = ?`;
  return get(sql, [id]);
}

/**
 * Get a vehicle by plate number
 * @param {string} plateNumber - Vehicle plate number
 * @returns {Promise<Object>} Vehicle object or null
 */
async function getVehicleByPlate(plateNumber) {
  const sql = `SELECT * FROM ${DB_TABLES.VEHICLES} WHERE plate_number = ?`;
  return get(sql, [plateNumber]);
}

/**
 * Create a new vehicle
 * @param {Object} vehicle - Vehicle object
 * @returns {Promise<Object>} Result object with lastID
 */
async function createVehicle(vehicle) {
  const sql = `
    INSERT INTO ${DB_TABLES.VEHICLES} 
    (plate_number, model, vehicle_type, status)
    VALUES (?, ?, ?, ?)
  `;
  
  const params = [
    vehicle.plate_number,
    vehicle.model || null,
    vehicle.vehicle_type || null,
    vehicle.status || 'active'
  ];
  
  return run(sql, params);
}

// === Rounds Methods ===

/**
 * Get all rounds
 * @returns {Promise<Array>} Array of rounds
 */
async function getRounds() {
  const sql = `
    SELECT r.*, 
           v.plate_number, 
           p.name as person_name
    FROM ${DB_TABLES.ROUNDS} r
    LEFT JOIN ${DB_TABLES.VEHICLES} v ON r.vehicle_id = v.id
    LEFT JOIN ${DB_TABLES.PEOPLE} p ON r.person_id = p.id
    ORDER BY r.start_time DESC
  `;
  return all(sql);
}

/**
 * Get a round by ID
 * @param {number} id - Round ID
 * @returns {Promise<Object>} Round object or null
 */
async function getRoundById(id) {
  const sql = `
    SELECT r.*, 
           v.plate_number, 
           p.name as person_name
    FROM ${DB_TABLES.ROUNDS} r
    LEFT JOIN ${DB_TABLES.VEHICLES} v ON r.vehicle_id = v.id
    LEFT JOIN ${DB_TABLES.PEOPLE} p ON r.person_id = p.id
    WHERE r.id = ?
  `;
  return get(sql, [id]);
}

/**
 * Create a new round
 * @param {Object} round - Round object
 * @returns {Promise<Object>} Result object with lastID
 */
async function createRound(round) {
  const sql = `
    INSERT INTO ${DB_TABLES.ROUNDS} 
    (vehicle_id, person_id, start_time, end_time, status)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  const params = [
    round.vehicle_id,
    round.person_id,
    round.start_time,
    round.end_time || null,
    round.status || 'active'
  ];
  
  return run(sql, params);
}

// === Alerts Methods ===

/**
 * Get alerts filtered by status
 * @param {string} status - Filter by status (pending, resolved, ignored, all)
 * @returns {Promise<Array>} Array of alerts
 */
async function getAlerts(status = 'pending') {
  let sql = `SELECT * FROM ${DB_TABLES.ALERTS}`;
  
  if (status && status !== 'all') {
    sql += ` WHERE status = '${status}'`;
  }
  
  sql += ` ORDER BY alert_date DESC, is_important DESC`;
  
  return all(sql);
}

/**
 * Get an alert by ID
 * @param {number} id - Alert ID
 * @returns {Promise<Object>} Alert object or null
 */
async function getAlertById(id) {
  const sql = `SELECT * FROM ${DB_TABLES.ALERTS} WHERE id = ?`;
  return get(sql, [id]);
}

/**
 * Create a new alert
 * @param {Object} alert - Alert object
 * @returns {Promise<Object>} Result object with lastID
 */
async function createAlert(alert) {
  const sql = `
    INSERT INTO ${DB_TABLES.ALERTS} 
    (plate_number, alert_date, alert_type, description, status, is_important)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    alert.plate_number,
    alert.alert_date || new Date().toISOString(),
    alert.alert_type || null,
    alert.description || null,
    alert.status || 'pending',
    alert.is_important ? 1 : 0
  ];
  
  return run(sql, params);
}

/**
 * Update alert status
 * @param {number} id - Alert ID
 * @param {string} status - New status value
 * @returns {Promise<Object>} Result object with changes
 */
async function updateAlertStatus(id, status) {
  const sql = `
    UPDATE ${DB_TABLES.ALERTS} 
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  return run(sql, [status, id]);
}

/**
 * Update alert importance flag
 * @param {number} id - Alert ID
 * @param {boolean} important - Whether the alert is important
 * @returns {Promise<Object>} Result object with changes
 */
async function updateAlertImportant(id, important) {
  const sql = `
    UPDATE ${DB_TABLES.ALERTS} 
    SET is_important = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  return run(sql, [important ? 1 : 0, id]);
}

/**
 * Count records in a table
 * @param {string} table - Table name
 * @returns {Promise<number>} Count of records
 */
async function countRecords(table) {
  try {
    const result = await get(`SELECT COUNT(*) as count FROM ${table}`);
    return result ? result.count : 0;
  } catch (error) {
    logger.error(`Error counting records in ${table}`, { error: error.message });
    return 0;
  }
}

// Export database functions
module.exports = {
  initDatabase,
  closeDatabase,
  run,
  get,
  all,
  transaction,
  getPeople,
  getPersonById,
  createPerson,
  getVehicles,
  getVehicleById,
  getVehicleByPlate,
  createVehicle,
  getRounds,
  getRoundById,
  createRound,
  getAlerts,
  getAlertById,
  createAlert,
  updateAlertStatus,
  updateAlertImportant,
  countRecords
}; 