const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class Database {
    constructor() {
        this.dbPath = null;
        this.db = null;
        this.initialized = false;
    }

    async init() {
        try {
            // Get the application data path
            const userDataPath = app.getPath('userData');
            
            // Create a 'database' directory if it doesn't exist
            const dbDir = path.join(userDataPath, 'database');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            
            // Set the database file path
            this.dbPath = path.join(dbDir, 'driverAlerts.db');
            
            // Create and initialize the database
            return new Promise((resolve, reject) => {
                this.db = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        reject(`Database error: ${err.message}`);
                        return;
                    }
                    
                    console.log('Connected to the SQLite database.');
                    this.initialized = true;
                    
                    // Create tables if they don't exist
                    this.createTables()
                        .then(() => resolve('Database initialized successfully'))
                        .catch(err => reject(err));
                });
            });
        } catch (error) {
            return Promise.reject(`Database initialization error: ${error.message}`);
        }
    }

    async createTables() {
        const createPeopleTable = `
            CREATE TABLE IF NOT EXISTS people (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                costcenter TEXT,
                phone TEXT,
                email TEXT,
                license_type TEXT,
                status TEXT,
                updated_at TEXT
            )
        `;
        
        const createVehiclesTable = `
            CREATE TABLE IF NOT EXISTS vehicles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platenumber TEXT NOT NULL UNIQUE,
                weight REAL,
                packtime INTEGER,
                type TEXT,
                status TEXT,
                max_capacity REAL,
                updated_at TEXT
            )
        `;
        
        const createAddressesTable = `
            CREATE TABLE IF NOT EXISTS addresses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                district TEXT NOT NULL,
                city TEXT NOT NULL,
                postal_code TEXT,
                notes TEXT,
                delivery_restrictions TEXT,
                updated_at TEXT
            )
        `;
        
        const createRoundsTable = `
            CREATE TABLE IF NOT EXISTS rounds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                day TEXT,
                planned_round_time INTEGER,
                addresses TEXT,
                platenumber TEXT,
                driver_id INTEGER,
                address_counts INTEGER,
                overall_weight REAL,
                round_start TEXT,
                round_end TEXT,
                packtime INTEGER,
                worktime_start TEXT,
                worktime_end TEXT,
                saved_time INTEGER,
                delta_drive_time INTEGER,
                updated_at TEXT,
                FOREIGN KEY (driver_id) REFERENCES people (id)
            )
        `;
        
        const createVehicleAssignmentsTable = `
            CREATE TABLE IF NOT EXISTS vehicle_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL,
                driver_id INTEGER NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT,
                assignment_type TEXT NOT NULL,
                approved_by TEXT,
                updated_at TEXT,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles (id),
                FOREIGN KEY (driver_id) REFERENCES people (id)
            )
        `;
        
        const createTimeRecordsTable = `
            CREATE TABLE IF NOT EXISTS time_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                driver_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                check_in_time TEXT,
                check_out_time TEXT,
                total_hours REAL,
                overtime_hours REAL,
                notes TEXT,
                updated_at TEXT,
                FOREIGN KEY (driver_id) REFERENCES people (id)
            )
        `;
        
        const createStopEventsAlertTable = `
            CREATE TABLE IF NOT EXISTS stop_events_alert (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platenumber TEXT NOT NULL,
                arrival_time TEXT NOT NULL,
                standing_duration INTEGER,
                ignition_status TEXT,
                position TEXT,
                important_point BOOLEAN,
                updated_at TEXT
            )
        `;
        
        const createSettingsTable = `
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT
            )
        `;
        
        // Add new staging tables for Excel imports
        const createStagingVehicleMovementsTable = `
            CREATE TABLE IF NOT EXISTS staging_vehicle_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platenumber TEXT NOT NULL,
                date TEXT NOT NULL,
                area_name TEXT,
                way TEXT,
                time_spent INTEGER,
                distance REAL,
                processed BOOLEAN DEFAULT 0,
                import_date TEXT NOT NULL,
                updated_at TEXT
            )
        `;
        
        const createStagingStopEventsTable = `
            CREATE TABLE IF NOT EXISTS staging_stop_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platenumber TEXT NOT NULL,
                arrival_time TEXT NOT NULL,
                stay_time INTEGER,
                ignition TEXT,
                location TEXT,
                important_info BOOLEAN,
                processed BOOLEAN DEFAULT 0,
                import_date TEXT NOT NULL,
                updated_at TEXT
            )
        `;
        
        const createStagingTimeRecordsTable = `
            CREATE TABLE IF NOT EXISTS staging_time_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                person_name TEXT NOT NULL,
                job_title TEXT,
                cost_center TEXT,
                date TEXT NOT NULL,
                planned_shift TEXT,
                actual_shift TEXT,
                check_in TEXT,
                check_out TEXT,
                processed BOOLEAN DEFAULT 0,
                import_date TEXT NOT NULL,
                updated_at TEXT
            )
        `;
        
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(createPeopleTable, (err) => {
                    if (err) {
                        reject(`Error creating people table: ${err.message}`);
                        return;
                    }
                    
                    this.db.run(createVehiclesTable, (err) => {
                        if (err) {
                            reject(`Error creating vehicles table: ${err.message}`);
                            return;
                        }
                        
                        this.db.run(createAddressesTable, (err) => {
                            if (err) {
                                reject(`Error creating addresses table: ${err.message}`);
                                return;
                            }
                            
                            this.db.run(createRoundsTable, (err) => {
                                if (err) {
                                    reject(`Error creating rounds table: ${err.message}`);
                                    return;
                                }
                                
                                this.db.run(createVehicleAssignmentsTable, (err) => {
                                    if (err) {
                                        reject(`Error creating vehicle_assignments table: ${err.message}`);
                                        return;
                                    }
                                    
                                    this.db.run(createTimeRecordsTable, (err) => {
                                        if (err) {
                                            reject(`Error creating time_records table: ${err.message}`);
                                            return;
                                        }
                                        
                                        this.db.run(createStopEventsAlertTable, (err) => {
                                            if (err) {
                                                reject(`Error creating stop_events_alert table: ${err.message}`);
                                                return;
                                            }
                                            
                                            this.db.run(createSettingsTable, (err) => {
                                                if (err) {
                                                    reject(`Error creating settings table: ${err.message}`);
                                                    return;
                                                }
                                                
                                                // Add the new staging tables
                                                this.db.run(createStagingVehicleMovementsTable, (err) => {
                                                    if (err) {
                                                        reject(`Error creating staging_vehicle_movements table: ${err.message}`);
                                                        return;
                                                    }
                                                    
                                                    this.db.run(createStagingStopEventsTable, (err) => {
                                                        if (err) {
                                                            reject(`Error creating staging_stop_events table: ${err.message}`);
                                                            return;
                                                        }
                                                        
                                                        this.db.run(createStagingTimeRecordsTable, (err) => {
                                                            if (err) {
                                                                reject(`Error creating staging_time_records table: ${err.message}`);
                                                                return;
                                                            }
                                                            
                                                            resolve('Tables created successfully');
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    // Driver operations
    async addDriver(driver) {
        const { name, licenseNumber, licenseExpiration, status } = driver;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO drivers (name, license_number, license_expiration, status, updated_at) 
                         VALUES (?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [name, licenseNumber, licenseExpiration, status, now], function(err) {
                if (err) {
                    reject(`Error adding driver: ${err.message}`);
                    return;
                }
                
                resolve({
                    id: this.lastID,
                    name,
                    licenseNumber,
                    licenseExpiration,
                    status,
                    updatedAt: now
                });
            });
        });
    }

    async getDrivers() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM drivers ORDER BY name';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching drivers: ${err.message}`);
                    return;
                }
                
                const drivers = rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    licenseNumber: row.license_number,
                    licenseExpiration: row.license_expiration,
                    status: row.status,
                    updatedAt: row.updated_at
                }));
                
                resolve(drivers);
            });
        });
    }

    async updateDriver(id, driver) {
        const { name, licenseNumber, licenseExpiration, status } = driver;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `UPDATE drivers 
                         SET name = ?, license_number = ?, license_expiration = ?, status = ?, updated_at = ? 
                         WHERE id = ?`;
            
            this.db.run(sql, [name, licenseNumber, licenseExpiration, status, now, id], function(err) {
                if (err) {
                    reject(`Error updating driver: ${err.message}`);
                    return;
                }
                
                if (this.changes === 0) {
                    reject(`No driver found with ID: ${id}`);
                    return;
                }
                
                resolve({
                    id,
                    name,
                    licenseNumber,
                    licenseExpiration,
                    status,
                    updatedAt: now
                });
            });
        });
    }

    async deleteDriver(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM drivers WHERE id = ?';
            
            this.db.run(sql, [id], function(err) {
                if (err) {
                    reject(`Error deleting driver: ${err.message}`);
                    return;
                }
                
                if (this.changes === 0) {
                    reject(`No driver found with ID: ${id}`);
                    return;
                }
                
                resolve({ id, deleted: true });
            });
        });
    }

    // Vehicle operations
    async addVehicle(vehicle) {
        const { make, model, licensePlate, lastInspection, status, driverId } = vehicle;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO vehicles (make, model, license_plate, last_inspection, status, driver_id, updated_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [make, model, licensePlate, lastInspection, status, driverId, now], function(err) {
                if (err) {
                    reject(`Error adding vehicle: ${err.message}`);
                    return;
                }
                
                resolve({
                    id: this.lastID,
                    make,
                    model,
                    licensePlate,
                    lastInspection,
                    status,
                    driverId,
                    updatedAt: now
                });
            });
        });
    }

    async getVehicles() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM vehicles ORDER BY make, model';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching vehicles: ${err.message}`);
                    return;
                }
                
                const vehicles = rows.map(row => ({
                    id: row.id,
                    make: row.make,
                    model: row.model,
                    licensePlate: row.license_plate,
                    lastInspection: row.last_inspection,
                    status: row.status,
                    driverId: row.driver_id,
                    updatedAt: row.updated_at
                }));
                
                resolve(vehicles);
            });
        });
    }

    async deleteVehicle(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM vehicles WHERE id = ?';
            
            this.db.run(sql, [id], function(err) {
                if (err) {
                    reject(`Error deleting vehicle: ${err.message}`);
                    return;
                }
                
                if (this.changes === 0) {
                    reject(`No vehicle found with ID: ${id}`);
                    return;
                }
                
                resolve({ id, deleted: true });
            });
        });
    }

    // Alert operations
    async addAlert(alert) {
        const { type, message, relatedId, relatedType, status } = alert;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO alerts (type, message, related_id, related_type, status, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [type, message, relatedId, relatedType, status, now], function(err) {
                if (err) {
                    reject(`Error adding alert: ${err.message}`);
                    return;
                }
                
                resolve({
                    id: this.lastID,
                    type,
                    message,
                    relatedId,
                    relatedType,
                    status,
                    createdAt: now
                });
            });
        });
    }

    async getAlerts() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM alerts ORDER BY created_at DESC';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching alerts: ${err.message}`);
                    return;
                }
                
                const alerts = rows.map(row => ({
                    id: row.id,
                    type: row.type,
                    message: row.message,
                    relatedId: row.related_id,
                    relatedType: row.related_type,
                    status: row.status,
                    createdAt: row.created_at,
                    readAt: row.read_at
                }));
                
                resolve(alerts);
            });
        });
    }

    async deleteAlert(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM alerts WHERE id = ?';
            
            this.db.run(sql, [id], function(err) {
                if (err) {
                    reject(`Error deleting alert: ${err.message}`);
                    return;
                }
                
                if (this.changes === 0) {
                    reject(`No alert found with ID: ${id}`);
                    return;
                }
                
                resolve({ id, deleted: true });
            });
        });
    }

    async close() {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db.close(err => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    this.initialized = false;
                    resolve('Database connection closed');
                });
            });
        }
        return Promise.resolve('No database connection to close');
    }

    // People operations
    async addPerson(person) {
        const { name, role, costcenter, phone, email, license_type, status } = person;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO people (name, role, costcenter, phone, email, license_type, status, updated_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [name, role, costcenter, phone, email, license_type, status, now], function(err) {
                if (err) {
                    reject(`Error adding person: ${err.message}`);
                    return;
                }
                
                resolve({
                    id: this.lastID,
                    name,
                    role,
                    costcenter,
                    phone,
                    email,
                    license_type,
                    status,
                    updatedAt: now
                });
            });
        });
    }

    async getPeople() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM people ORDER BY name';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching people: ${err.message}`);
                    return;
                }
                
                const people = rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    role: row.role,
                    costcenter: row.costcenter,
                    phone: row.phone,
                    email: row.email,
                    license_type: row.license_type,
                    status: row.status,
                    updatedAt: row.updated_at
                }));
                
                resolve(people);
            });
        });
    }

    async updatePerson(id, person) {
        const { name, role, costcenter, phone, email, license_type, status } = person;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `UPDATE people 
                         SET name = ?, role = ?, costcenter = ?, phone = ?, email = ?, license_type = ?, status = ?, updated_at = ? 
                         WHERE id = ?`;
            
            this.db.run(sql, [name, role, costcenter, phone, email, license_type, status, now, id], function(err) {
                if (err) {
                    reject(`Error updating person: ${err.message}`);
                    return;
                }
                
                if (this.changes === 0) {
                    reject(`No person found with ID: ${id}`);
                    return;
                }
                
                resolve({
                    id,
                    name,
                    role,
                    costcenter,
                    phone,
                    email,
                    license_type,
                    status,
                    updatedAt: now
                });
            });
        });
    }

    async deletePerson(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM people WHERE id = ?';
            
            this.db.run(sql, [id], function(err) {
                if (err) {
                    reject(`Error deleting person: ${err.message}`);
                    return;
                }
                
                if (this.changes === 0) {
                    reject(`No person found with ID: ${id}`);
                    return;
                }
                
                resolve({ id, deleted: true });
            });
        });
    }

    // Vehicle operations
    async addVehicle(vehicle) {
        const { platenumber, weight, packtime, type, status, max_capacity } = vehicle;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO vehicles (platenumber, weight, packtime, type, status, max_capacity, updated_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [platenumber, weight, packtime, type, status, max_capacity, now], function(err) {
                if (err) {
                    reject(`Error adding vehicle: ${err.message}`);
                    return;
                }
                
                resolve({
                    id: this.lastID,
                    platenumber,
                    weight,
                    packtime,
                    type,
                    status,
                    max_capacity,
                    updatedAt: now
                });
            });
        });
    }

    async getVehicles() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM vehicles ORDER BY platenumber';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching vehicles: ${err.message}`);
                    return;
                }
                
                const vehicles = rows.map(row => ({
                    id: row.id,
                    platenumber: row.platenumber,
                    weight: row.weight,
                    packtime: row.packtime,
                    type: row.type,
                    status: row.status,
                    max_capacity: row.max_capacity,
                    updatedAt: row.updated_at
                }));
                
                resolve(vehicles);
            });
        });
    }

    async updateVehicle(id, vehicle) {
        const { platenumber, weight, packtime, type, status, max_capacity } = vehicle;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `UPDATE vehicles 
                         SET platenumber = ?, weight = ?, packtime = ?, type = ?, status = ?, max_capacity = ?, updated_at = ? 
                         WHERE id = ?`;
            
            this.db.run(sql, [platenumber, weight, packtime, type, status, max_capacity, now, id], function(err) {
                if (err) {
                    reject(`Error updating vehicle: ${err.message}`);
                    return;
                }
                
                if (this.changes === 0) {
                    reject(`No vehicle found with ID: ${id}`);
                    return;
                }
                
                resolve({
                    id,
                    platenumber,
                    weight,
                    packtime,
                    type,
                    status,
                    max_capacity,
                    updatedAt: now
                });
            });
        });
    }

    async deleteVehicle(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM vehicles WHERE id = ?';
            
            this.db.run(sql, [id], function(err) {
                if (err) {
                    reject(`Error deleting vehicle: ${err.message}`);
                    return;
                }
                
                if (this.changes === 0) {
                    reject(`No vehicle found with ID: ${id}`);
                    return;
                }
                
                resolve({ id, deleted: true });
            });
        });
    }

    // Address operations
    async addAddress(address) {
        const { district, city, postal_code, notes, delivery_restrictions } = address;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO addresses (district, city, postal_code, notes, delivery_restrictions, updated_at) 
                         VALUES (?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [district, city, postal_code, notes, delivery_restrictions, now], function(err) {
                if (err) {
                    reject(`Error adding address: ${err.message}`);
                    return;
                }
                
                resolve({
                    id: this.lastID,
                    district,
                    city,
                    postal_code,
                    notes,
                    delivery_restrictions,
                    updatedAt: now
                });
            });
        });
    }

    async getAddresses() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM addresses ORDER BY district, city';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching addresses: ${err.message}`);
                    return;
                }
                
                const addresses = rows.map(row => ({
                    id: row.id,
                    district: row.district,
                    city: row.city,
                    postal_code: row.postal_code,
                    notes: row.notes,
                    delivery_restrictions: row.delivery_restrictions,
                    updatedAt: row.updated_at
                }));
                
                resolve(addresses);
            });
        });
    }

    async updateAddress(id, address) {
        const { district, city, postal_code, notes, delivery_restrictions } = address;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `UPDATE addresses 
                         SET district = ?, city = ?, postal_code = ?, notes = ?, delivery_restrictions = ?, updated_at = ? 
                         WHERE id = ?`;
            
            this.db.run(sql, [district, city, postal_code, notes, delivery_restrictions, now, id], function(err) {
                if (err) {
                    reject(`Error updating address: ${err.message}`);
                    return;
                }
                
                if (this.changes === 0) {
                    reject(`No address found with ID: ${id}`);
                    return;
                }
                
                resolve({
                    id,
                    district,
                    city,
                    postal_code,
                    notes,
                    delivery_restrictions,
                    updatedAt: now
                });
            });
        });
    }

    async deleteAddress(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM addresses WHERE id = ?';
            
            this.db.run(sql, [id], function(err) {
                if (err) {
                    reject(`Error deleting address: ${err.message}`);
                    return;
                }
                
                if (this.changes === 0) {
                    reject(`No address found with ID: ${id}`);
                    return;
                }
                
                resolve({ id, deleted: true });
            });
        });
    }

    // Round operations
    async addRound(round) {
        const { 
            date, day, planned_round_time, addresses, platenumber, driver_id, 
            address_counts, overall_weight, round_start, round_end, packtime, 
            worktime_start, worktime_end, saved_time, delta_drive_time 
        } = round;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO rounds (
                date, day, planned_round_time, addresses, platenumber, 
                driver_id, address_counts, overall_weight, round_start, 
                round_end, packtime, worktime_start, worktime_end, 
                saved_time, delta_drive_time, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                date, day, planned_round_time, addresses, platenumber,
                driver_id, address_counts, overall_weight, round_start,
                round_end, packtime, worktime_start, worktime_end,
                saved_time, delta_drive_time, now
            ], function(err) {
                if (err) {
                    reject(`Error adding round: ${err.message}`);
                    return;
                }
                
                resolve({
                    id: this.lastID,
                    date, day, planned_round_time, addresses, platenumber,
                    driver_id, address_counts, overall_weight, round_start,
                    round_end, packtime, worktime_start, worktime_end,
                    saved_time, delta_drive_time,
                    updatedAt: now
                });
            });
        });
    }

    async getRounds() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM rounds ORDER BY date DESC';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching rounds: ${err.message}`);
                    return;
                }
                
                const rounds = rows.map(row => ({
                    id: row.id,
                    date: row.date,
                    day: row.day,
                    planned_round_time: row.planned_round_time,
                    addresses: row.addresses,
                    platenumber: row.platenumber,
                    driver_id: row.driver_id,
                    address_counts: row.address_counts,
                    overall_weight: row.overall_weight,
                    round_start: row.round_start,
                    round_end: row.round_end,
                    packtime: row.packtime,
                    worktime_start: row.worktime_start,
                    worktime_end: row.worktime_end,
                    saved_time: row.saved_time,
                    delta_drive_time: row.delta_drive_time,
                    updatedAt: row.updated_at
                }));
                
                resolve(rounds);
            });
        });
    }

    // Vehicle Assignment operations
    async addVehicleAssignment(assignment) {
        const { vehicle_id, driver_id, start_date, end_date, assignment_type, approved_by } = assignment;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO vehicle_assignments (
                vehicle_id, driver_id, start_date, end_date, assignment_type, approved_by, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                vehicle_id, driver_id, start_date, end_date, assignment_type, approved_by, now
            ], function(err) {
                if (err) {
                    reject(`Error adding vehicle assignment: ${err.message}`);
                    return;
                }
                
                resolve({
                    id: this.lastID,
                    vehicle_id, driver_id, start_date, end_date, assignment_type, approved_by,
                    updatedAt: now
                });
            });
        });
    }

    async getVehicleAssignments() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM vehicle_assignments ORDER BY start_date DESC';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching vehicle assignments: ${err.message}`);
                    return;
                }
                
                const assignments = rows.map(row => ({
                    id: row.id,
                    vehicle_id: row.vehicle_id,
                    driver_id: row.driver_id,
                    start_date: row.start_date,
                    end_date: row.end_date,
                    assignment_type: row.assignment_type,
                    approved_by: row.approved_by,
                    updatedAt: row.updated_at
                }));
                
                resolve(assignments);
            });
        });
    }

    // Time Record operations
    async addTimeRecord(record) {
        const { driver_id, date, check_in_time, check_out_time, total_hours, overtime_hours, notes } = record;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO time_records (
                driver_id, date, check_in_time, check_out_time, 
                total_hours, overtime_hours, notes, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                driver_id, date, check_in_time, check_out_time,
                total_hours, overtime_hours, notes, now
            ], function(err) {
                if (err) {
                    reject(`Error adding time record: ${err.message}`);
                    return;
                }
                
                resolve({
                    id: this.lastID,
                    driver_id, date, check_in_time, check_out_time,
                    total_hours, overtime_hours, notes,
                    updatedAt: now
                });
            });
        });
    }

    async getTimeRecords() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM time_records ORDER BY date DESC, driver_id';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching time records: ${err.message}`);
                    return;
                }
                
                const records = rows.map(row => ({
                    id: row.id,
                    driver_id: row.driver_id,
                    date: row.date,
                    check_in_time: row.check_in_time,
                    check_out_time: row.check_out_time,
                    total_hours: row.total_hours,
                    overtime_hours: row.overtime_hours,
                    notes: row.notes,
                    updatedAt: row.updated_at
                }));
                
                resolve(records);
            });
        });
    }

    // Stop Events Alert operations
    async addStopEventAlert(alert) {
        const { platenumber, arrival_time, standing_duration, ignition_status, position, important_point } = alert;
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO stop_events_alert (
                platenumber, arrival_time, standing_duration, 
                ignition_status, position, important_point, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                platenumber, arrival_time, standing_duration,
                ignition_status, position, important_point ? 1 : 0, now
            ], function(err) {
                if (err) {
                    reject(`Error adding stop event alert: ${err.message}`);
                    return;
                }
                
                resolve({
                    id: this.lastID,
                    platenumber, arrival_time, standing_duration,
                    ignition_status, position, important_point,
                    updatedAt: now
                });
            });
        });
    }

    async getStopEventAlerts() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM stop_events_alert ORDER BY arrival_time DESC';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching stop event alerts: ${err.message}`);
                    return;
                }
                
                const alerts = rows.map(row => ({
                    id: row.id,
                    platenumber: row.platenumber,
                    arrival_time: row.arrival_time,
                    standing_duration: row.standing_duration,
                    ignition_status: row.ignition_status,
                    position: row.position,
                    important_point: Boolean(row.important_point),
                    updatedAt: row.updated_at
                }));
                
                resolve(alerts);
            });
        });
    }

    // Settings operations
    async setSetting(key, value) {
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT OR REPLACE INTO settings (key, value, updated_at) 
                         VALUES (?, ?, ?)`;
            
            this.db.run(sql, [key, value, now], function(err) {
                if (err) {
                    reject(`Error setting value: ${err.message}`);
                    return;
                }
                
                resolve({
                    key,
                    value,
                    updatedAt: now
                });
            });
        });
    }

    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM settings WHERE key = ?';
            
            this.db.get(sql, [key], (err, row) => {
                if (err) {
                    reject(`Error getting setting: ${err.message}`);
                    return;
                }
                
                if (!row) {
                    resolve(null);
                } else {
                    resolve({
                        key: row.key,
                        value: row.value,
                        updatedAt: row.updated_at
                    });
                }
            });
        });
    }

    async getAllSettings() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM settings';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(`Error fetching settings: ${err.message}`);
                    return;
                }
                
                const settings = rows.map(row => ({
                    key: row.key,
                    value: row.value,
                    updatedAt: row.updated_at
                }));
                
                resolve(settings);
            });
        });
    }

    // Add methods for working with the staging tables
    async importVehicleMovements(data) {
        const now = new Date().toISOString();
        const importDate = now.split('T')[0];
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO staging_vehicle_movements 
                (platenumber, date, area_name, way, time_spent, distance, import_date, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            let successCount = 0;
            let errorCount = 0;
            
            // Begin transaction
            this.db.run('BEGIN TRANSACTION');
            
            data.forEach(item => {
                try {
                    stmt.run(
                        item.platenumber,
                        item.date,
                        item.area_name,
                        item.way,
                        item.time_spent,
                        item.distance,
                        importDate,
                        now
                    );
                    successCount++;
                } catch (error) {
                    console.error(`Error importing vehicle movement: ${error.message}`);
                    errorCount++;
                }
            });
            
            // Finalize statement
            stmt.finalize();
            
            // Commit transaction
            this.db.run('COMMIT', err => {
                if (err) {
                    this.db.run('ROLLBACK');
                    reject(`Transaction failed: ${err.message}`);
                    return;
                }
                
                resolve({
                    success: successCount,
                    errors: errorCount,
                    importDate
                });
            });
        });
    }

    async importStopEvents(data) {
        const now = new Date().toISOString();
        const importDate = now.split('T')[0];
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO staging_stop_events 
                (platenumber, arrival_time, stay_time, ignition, location, important_info, import_date, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            let successCount = 0;
            let errorCount = 0;
            
            // Begin transaction
            this.db.run('BEGIN TRANSACTION');
            
            data.forEach(item => {
                try {
                    stmt.run(
                        item.platenumber,
                        item.arrival_time,
                        item.stay_time,
                        item.ignition,
                        item.location,
                        item.important_info ? 1 : 0,
                        importDate,
                        now
                    );
                    successCount++;
                } catch (error) {
                    console.error(`Error importing stop event: ${error.message}`);
                    errorCount++;
                }
            });
            
            // Finalize statement
            stmt.finalize();
            
            // Commit transaction
            this.db.run('COMMIT', err => {
                if (err) {
                    this.db.run('ROLLBACK');
                    reject(`Transaction failed: ${err.message}`);
                    return;
                }
                
                resolve({
                    success: successCount,
                    errors: errorCount,
                    importDate
                });
            });
        });
    }

    async importTimeRecords(data) {
        const now = new Date().toISOString();
        const importDate = now.split('T')[0];
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO staging_time_records 
                (person_name, job_title, cost_center, date, planned_shift, actual_shift, check_in, check_out, import_date, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            let successCount = 0;
            let errorCount = 0;
            
            // Begin transaction
            this.db.run('BEGIN TRANSACTION');
            
            data.forEach(item => {
                try {
                    stmt.run(
                        item.person_name,
                        item.job_title,
                        item.cost_center,
                        item.date,
                        item.planned_shift,
                        item.actual_shift,
                        item.check_in,
                        item.check_out,
                        importDate,
                        now
                    );
                    successCount++;
                } catch (error) {
                    console.error(`Error importing time record: ${error.message}`);
                    errorCount++;
                }
            });
            
            // Finalize statement
            stmt.finalize();
            
            // Commit transaction
            this.db.run('COMMIT', err => {
                if (err) {
                    this.db.run('ROLLBACK');
                    reject(`Transaction failed: ${err.message}`);
                    return;
                }
                
                resolve({
                    success: successCount,
                    errors: errorCount,
                    importDate
                });
            });
        });
    }

    // Method to get vehicle rounds (connecting vehicles and rounds)
    async getVehicleRounds(platenumber = null) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    v.id as vehicle_id, 
                    v.platenumber,
                    r.id as round_id,
                    r.date, 
                    r.driver_id,
                    p.name as driver_name,
                    r.round_start,
                    r.round_end
                FROM vehicles v
                LEFT JOIN rounds r ON v.platenumber = r.platenumber
                LEFT JOIN people p ON r.driver_id = p.id
                ${platenumber ? 'WHERE v.platenumber = ?' : ''}
                ORDER BY r.date DESC
            `;
            
            const params = platenumber ? [platenumber] : [];
            
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(`Error getting vehicle rounds: ${err.message}`);
                    return;
                }
                
                resolve(rows);
            });
        });
    }
}

module.exports = new Database(); 