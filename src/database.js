const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class DriverAlertsDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.ensureDatabaseDirectory();
    this.db = new Database(dbPath);
    this.createTables();
  }

  ensureDatabaseDirectory() {
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  createTables() {
    // Create tables if they don't exist
    const tables = {
      people: `
        CREATE TABLE IF NOT EXISTS people (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          job_title TEXT,
          cost_center TEXT,
          status TEXT CHECK(status IN ('active', 'inactive', 'archived')) DEFAULT 'active',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `,
      vehicles: `
        CREATE TABLE IF NOT EXISTS vehicles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plate_number TEXT NOT NULL UNIQUE,
          vehicle_type TEXT,
          status TEXT CHECK(status IN ('active', 'inactive', 'maintenance', 'archived')) DEFAULT 'active',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `,
      addresses: `
        CREATE TABLE IF NOT EXISTS addresses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          address TEXT NOT NULL,
          city TEXT,
          postal_code TEXT,
          country TEXT DEFAULT 'Finland',
          location_type TEXT CHECK(location_type IN ('customer', 'warehouse', 'other')) DEFAULT 'customer',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `,
      rounds: `
        CREATE TABLE IF NOT EXISTS rounds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          date TEXT NOT NULL,
          driver_id INTEGER,
          vehicle_id INTEGER,
          start_time TEXT,
          end_time TEXT,
          status TEXT CHECK(status IN ('planned', 'in_progress', 'completed', 'cancelled')) DEFAULT 'planned',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (driver_id) REFERENCES people (id),
          FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
        )
      `,
      vehicle_assignments: `
        CREATE TABLE IF NOT EXISTS vehicle_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          driver_id INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT,
          status TEXT CHECK(status IN ('active', 'ended', 'cancelled')) DEFAULT 'active',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles (id),
          FOREIGN KEY (driver_id) REFERENCES people (id)
        )
      `,
      time_records: `
        CREATE TABLE IF NOT EXISTS time_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          person_id INTEGER NOT NULL,
          date TEXT NOT NULL,
          check_in TEXT,
          check_out TEXT,
          planned_shift TEXT,
          actual_shift TEXT,
          status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (person_id) REFERENCES people (id)
        )
      `,
      stop_events_alert: `
        CREATE TABLE IF NOT EXISTS stop_events_alert (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          alert_type TEXT CHECK(alert_type IN ('extended_stop', 'unexpected_stop', 'deviation', 'other')) DEFAULT 'other',
          location TEXT,
          timestamp TEXT NOT NULL,
          duration INTEGER,
          status TEXT CHECK(status IN ('new', 'acknowledged', 'resolved', 'ignored')) DEFAULT 'new',
          details TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
        )
      `,
      settings: `
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          description TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `,
      // Add staging tables for Excel imports
      staging_vehicle_movements: `
        CREATE TABLE IF NOT EXISTS staging_vehicle_movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platenumber TEXT NOT NULL,
          date TEXT NOT NULL,
          area_name TEXT,
          way TEXT,
          time_spent INTEGER,
          distance REAL,
          processed INTEGER DEFAULT 0,
          import_date TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `,
      staging_stop_events: `
        CREATE TABLE IF NOT EXISTS staging_stop_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platenumber TEXT NOT NULL,
          arrival_time TEXT NOT NULL,
          stay_time INTEGER,
          ignition TEXT,
          location TEXT,
          important_info INTEGER DEFAULT 0,
          processed INTEGER DEFAULT 0,
          import_date TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `,
      staging_time_records: `
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
          processed INTEGER DEFAULT 0,
          import_date TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `
    };

    // Execute all table creation queries
    for (const [tableName, query] of Object.entries(tables)) {
      try {
        this.db.exec(query);
        console.log(`Table ${tableName} created or already exists`);
        
        // After creating vehicles table, check if plate_number column exists
        if (tableName === 'vehicles') {
          this.ensureVehiclesColumns();
        }
        
        // After creating stop_events_alert table, check if timestamp column exists
        if (tableName === 'stop_events_alert') {
          this.ensureStopEventsColumns();
        }
      } catch (error) {
        console.error(`Error creating table ${tableName}:`, error);
      }
    }
  }
  
  // Ensure the vehicles table has the correct columns
  ensureVehiclesColumns() {
    try {
      const tableInfo = this.db.prepare(`PRAGMA table_info(vehicles)`).all();
      const hasPlateNumber = tableInfo.some(col => col.name === 'plate_number');
      
      if (!hasPlateNumber) {
        console.warn("Adding missing plate_number column to vehicles table");
        // Add the missing column
        this.db.exec(`ALTER TABLE vehicles ADD COLUMN plate_number TEXT DEFAULT 'Unknown'`);
      }
    } catch (error) {
      console.error('Error ensuring vehicle columns:', error);
    }
  }
  
  // Ensure the stop_events_alert table has the correct columns
  ensureStopEventsColumns() {
    try {
      const tableInfo = this.db.prepare(`PRAGMA table_info(stop_events_alert)`).all();
      const hasTimestamp = tableInfo.some(col => col.name === 'timestamp');
      
      if (!hasTimestamp) {
        console.warn("Adding missing timestamp column to stop_events_alert table");
        // Add the missing column
        this.db.exec(`ALTER TABLE stop_events_alert ADD COLUMN timestamp TEXT DEFAULT CURRENT_TIMESTAMP`);
      }
    } catch (error) {
      console.error('Error ensuring stop events columns:', error);
    }
  }

  // CRUD operations for people
  async createPerson(personData) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO people (name, job_title, cost_center, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
      
      const result = stmt.run(
        personData.name,
        personData.job_title || null,
        personData.cost_center || null,
        personData.status || 'active',
        personData.notes || null
      );
      
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error creating person:', error);
      throw error;
    }
  }

  async getPeople() {
    try {
      const query = `SELECT * FROM people ORDER BY name`;
      return this.db.prepare(query).all();
    } catch (error) {
      console.error('Error getting people:', error);
      throw error;
    }
  }

  async getPersonById(id) {
    try {
      const query = `SELECT * FROM people WHERE id = ?`;
      return this.db.prepare(query).get(id);
    } catch (error) {
      console.error('Error getting person by ID:', error);
      throw error;
    }
  }

  async updatePerson(id, personData) {
    try {
      // Build the update query dynamically based on the fields provided
      const fields = Object.keys(personData).filter(key => key !== 'id');
      if (fields.length === 0) return null;
      
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const query = `
        UPDATE people
        SET ${setClause}, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      const values = [...fields.map(field => personData[field]), id];
      const result = this.db.prepare(query).run(...values);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating person:', error);
      throw error;
    }
  }

  async deletePerson(id) {
    try {
      const query = `DELETE FROM people WHERE id = ?`;
      const result = this.db.prepare(query).run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting person:', error);
      throw error;
    }
  }

  // CRUD operations for vehicles
  async createVehicle(vehicleData) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO vehicles (plate_number, vehicle_type, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
      
      const result = stmt.run(
        vehicleData.plate_number,
        vehicleData.vehicle_type || null,
        vehicleData.status || 'active',
        vehicleData.notes || null
      );
      
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  }

  async getVehicles() {
    try {
      // First check if the table exists and has the plate_number column
      try {
        const tableInfo = this.db.prepare(`PRAGMA table_info(vehicles)`).all();
        const hasPlateNumber = tableInfo.some(col => col.name === 'plate_number');
        
        if (!hasPlateNumber) {
          console.warn("vehicles table doesn't have plate_number column, returning empty array");
          return [];
        }
        
        const query = `SELECT * FROM vehicles ORDER BY plate_number`;
        return this.db.prepare(query).all();
      } catch (error) {
        console.warn("Error checking vehicles table:", error);
        return [];
      }
    } catch (error) {
      console.error('Error getting vehicles:', error);
      return []; // Return empty array instead of throwing to avoid crashing
    }
  }

  async getVehicleById(id) {
    try {
      const query = `SELECT * FROM vehicles WHERE id = ?`;
      return this.db.prepare(query).get(id);
    } catch (error) {
      console.error('Error getting vehicle by ID:', error);
      throw error;
    }
  }

  async updateVehicle(id, vehicleData) {
    try {
      // Build the update query dynamically
      const fields = Object.keys(vehicleData).filter(key => key !== 'id');
      if (fields.length === 0) return null;
      
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const query = `
        UPDATE vehicles
        SET ${setClause}, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      const values = [...fields.map(field => vehicleData[field]), id];
      const result = this.db.prepare(query).run(...values);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating vehicle:', error);
      throw error;
    }
  }

  async deleteVehicle(id) {
    try {
      const query = `DELETE FROM vehicles WHERE id = ?`;
      const result = this.db.prepare(query).run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      throw error;
    }
  }

  // Count methods
  async countRecords(table) {
    try {
      // Map the table name if needed (e.g., 'alerts' should query 'stop_events_alert')
      const tableMap = {
        'alerts': 'stop_events_alert'
      };
      
      const actualTable = tableMap[table] || table;
      
      const query = `SELECT COUNT(*) as count FROM ${actualTable}`;
      const result = this.db.prepare(query).get();
      return result.count;
    } catch (error) {
      console.error(`Error counting ${table}:`, error);
      return 0;
    }
  }

  // Add methods for getting vehicle by platenumber
  async getVehicleByPlatenumber(platenumber) {
    if (!platenumber) return null;
    
    try {
      const query = `
        SELECT * FROM vehicles 
        WHERE plate_number = ?
        LIMIT 1
      `;
      return this.db.prepare(query).get(platenumber);
    } catch (error) {
      console.error('Error getting vehicle by platenumber:', error);
      throw error;
    }
  }

  // Add method for getting person by name
  async getPersonByName(name) {
    if (!name) return null;
    
    try {
      const query = `
        SELECT * FROM people 
        WHERE name = ?
        LIMIT 1
      `;
      return this.db.prepare(query).get(name);
    } catch (error) {
      console.error('Error getting person by name:', error);
      throw error;
    }
  }

  // Get vehicle rounds (for connecting vehicles with rounds)
  async getVehicleRounds(platenumber = null) {
    try {
      let query = `
        SELECT 
          v.id as vehicle_id,
          v.plate_number,
          r.id as round_id,
          r.name as round_name,
          r.date as round_date,
          p.id as driver_id,
          p.name as driver_name
        FROM 
          vehicles v
        LEFT JOIN 
          rounds r ON r.vehicle_id = v.id
        LEFT JOIN 
          people p ON r.driver_id = p.id
      `;
      
      // Add filter for specific platenumber if provided
      const params = [];
      if (platenumber) {
        query += ` WHERE v.plate_number = ?`;
        params.push(platenumber);
      }
      
      query += ` ORDER BY r.date DESC`;
      
      return this.db.prepare(query).all(...params);
    } catch (error) {
      console.error('Error getting vehicle rounds:', error);
      throw error;
    }
  }

  // Get staged vehicle movements
  async getUnprocessedVehicleMovements() {
    try {
      const query = `
        SELECT * FROM staging_vehicle_movements 
        WHERE processed = 0
        ORDER BY date
      `;
      return this.db.prepare(query).all();
    } catch (error) {
      console.error('Error getting unprocessed vehicle movements:', error);
      throw error;
    }
  }

  // Get staged stop events
  async getUnprocessedStopEvents() {
    try {
      const query = `
        SELECT * FROM staging_stop_events 
        WHERE processed = 0
        ORDER BY arrival_time
      `;
      return this.db.prepare(query).all();
    } catch (error) {
      console.error('Error getting unprocessed stop events:', error);
      throw error;
    }
  }

  // Get staged time records
  async getUnprocessedTimeRecords() {
    try {
      const query = `
        SELECT * FROM staging_time_records 
        WHERE processed = 0
        ORDER BY date
      `;
      return this.db.prepare(query).all();
    } catch (error) {
      console.error('Error getting unprocessed time records:', error);
      throw error;
    }
  }

  // Mark staging record as processed
  async markVehicleMovementProcessed(id) {
    try {
      const query = `
        UPDATE staging_vehicle_movements 
        SET processed = 1,
            updated_at = datetime('now') 
        WHERE id = ?
      `;
      return this.db.prepare(query).run(id);
    } catch (error) {
      console.error('Error marking vehicle movement as processed:', error);
      throw error;
    }
  }

  async markStopEventProcessed(id) {
    try {
      const query = `
        UPDATE staging_stop_events 
        SET processed = 1,
            updated_at = datetime('now') 
        WHERE id = ?
      `;
      return this.db.prepare(query).run(id);
    } catch (error) {
      console.error('Error marking stop event as processed:', error);
      throw error;
    }
  }

  async markTimeRecordProcessed(id) {
    try {
      const query = `
        UPDATE staging_time_records 
        SET processed = 1,
            updated_at = datetime('now') 
        WHERE id = ?
      `;
      return this.db.prepare(query).run(id);
    } catch (error) {
      console.error('Error marking time record as processed:', error);
      throw error;
    }
  }

  // Import methods for staging tables
  async importVehicleMovements(data) {
    const result = { success: 0, errors: 0, total: data.length };
    
    if (!data || data.length === 0) {
      return result;
    }
    
    try {
      // Begin transaction
      const transaction = this.db.transaction((movements) => {
        const stmt = this.db.prepare(`
          INSERT INTO staging_vehicle_movements (
            platenumber, date, area_name, way, time_spent, distance, 
            processed, import_date, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
        `);
        
        for (const movement of movements) {
          try {
            stmt.run(
              movement.platenumber,
              movement.date,
              movement.area_name,
              movement.way,
              movement.time_spent,
              movement.distance
            );
            result.success++;
          } catch (error) {
            console.error('Error inserting vehicle movement:', error);
            result.errors++;
          }
        }
      });
      
      // Execute transaction
      transaction(data);
      
      return result;
    } catch (error) {
      console.error('Error importing vehicle movements:', error);
      throw error;
    }
  }

  async importStopEvents(data) {
    const result = { success: 0, errors: 0, total: data.length };
    
    if (!data || data.length === 0) {
      return result;
    }
    
    try {
      // Begin transaction
      const transaction = this.db.transaction((events) => {
        const stmt = this.db.prepare(`
          INSERT INTO staging_stop_events (
            platenumber, arrival_time, stay_time, ignition, location, important_info, 
            processed, import_date, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
        `);
        
        for (const event of events) {
          try {
            stmt.run(
              event.platenumber,
              event.arrival_time,
              event.stay_time,
              event.ignition,
              event.location,
              event.important_info ? 1 : 0
            );
            result.success++;
          } catch (error) {
            console.error('Error inserting stop event:', error);
            result.errors++;
          }
        }
      });
      
      // Execute transaction
      transaction(data);
      
      return result;
    } catch (error) {
      console.error('Error importing stop events:', error);
      throw error;
    }
  }

  async importTimeRecords(data) {
    const result = { success: 0, errors: 0, total: data.length };
    
    if (!data || data.length === 0) {
      return result;
    }
    
    try {
      // Begin transaction
      const transaction = this.db.transaction((records) => {
        const stmt = this.db.prepare(`
          INSERT INTO staging_time_records (
            person_name, job_title, cost_center, date, planned_shift, actual_shift, 
            check_in, check_out, processed, import_date, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
        `);
        
        for (const record of records) {
          try {
            stmt.run(
              record.person_name,
              record.job_title,
              record.cost_center,
              record.date,
              record.planned_shift,
              record.actual_shift,
              record.check_in,
              record.check_out
            );
            result.success++;
          } catch (error) {
            console.error('Error inserting time record:', error);
            result.errors++;
          }
        }
      });
      
      // Execute transaction
      transaction(data);
      
      return result;
    } catch (error) {
      console.error('Error importing time records:', error);
      throw error;
    }
  }

  // Create an alert
  async createAlert(alertData) {
    try {
      const query = `
        INSERT INTO stop_events_alert (
          vehicle_id, alert_type, location, timestamp, duration, status, details, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
      
      const result = this.db.prepare(query).run(
        alertData.vehicle_id,
        alertData.alert_type,
        alertData.location,
        alertData.timestamp,
        alertData.duration,
        alertData.status,
        alertData.details
      );
      
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  }

  // Update alert status
  async updateAlertStatus(id, status) {
    try {
      const query = `
        UPDATE stop_events_alert 
        SET status = ?,
            updated_at = datetime('now') 
        WHERE id = ?
      `;
      return this.db.prepare(query).run(status, id);
    } catch (error) {
      console.error('Error updating alert status:', error);
      throw error;
    }
  }

  // Close the database connection
  close() {
    if (this.db) {
      this.db.close();
    }
  }

  // Add methods for getting alerts
  async getAlerts() {
    try {
      console.log("Getting alerts from stop_events_alert table");
      // First check if the table exists and has the timestamp column
      try {
        const tableInfo = this.db.prepare(`PRAGMA table_info(stop_events_alert)`).all();
        const hasTimestamp = tableInfo.some(col => col.name === 'timestamp');
        
        if (!hasTimestamp) {
          console.warn("stop_events_alert table doesn't have timestamp column, returning empty array");
          return [];
        }
        
        const query = `
          SELECT * FROM stop_events_alert 
          ORDER BY timestamp DESC
        `;
        return this.db.prepare(query).all();
      } catch (error) {
        console.warn("Error checking stop_events_alert table:", error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return [];  // Return empty array instead of throwing to avoid crashing
    }
  }

  // Add methods for getting rounds
  async getRounds() {
    try {
      // First check if the table exists and has the date column
      try {
        const tableInfo = this.db.prepare(`PRAGMA table_info(rounds)`).all();
        const hasDate = tableInfo.some(col => col.name === 'date');
        
        if (!hasDate) {
          console.warn("rounds table doesn't have date column, returning empty array");
          return [];
        }
        
        const query = `
          SELECT * FROM rounds 
          ORDER BY date DESC
        `;
        return this.db.prepare(query).all();
      } catch (error) {
        console.warn("Error checking rounds table:", error);
        return [];
      }
    } catch (error) {
      console.error('Error getting rounds:', error);
      return []; // Return empty array instead of throwing to avoid crashing
    }
  }

  async getRoundById(id) {
    try {
      const query = `SELECT * FROM rounds WHERE id = ?`;
      return this.db.prepare(query).get(id);
    } catch (error) {
      console.error('Error getting round by ID:', error);
      return null;  // Return null instead of throwing to avoid crashing
    }
  }

  // Add demo data for testing
  async insertDemoData() {
    try {
      console.log("Inserting demo data...");
      
      // Begin transaction
      this.db.exec('BEGIN TRANSACTION');
      
      // Insert demo people
      const people = [
        { name: 'John Smith', job_title: 'Driver', cost_center: 'Transport', status: 'active' },
        { name: 'Emma Johnson', job_title: 'Senior Driver', cost_center: 'Transport', status: 'active' },
        { name: 'Michael Brown', job_title: 'Driver', cost_center: 'Logistics', status: 'active' }
      ];
      
      for (const person of people) {
        try {
          this.db.prepare(`
            INSERT INTO people (name, job_title, cost_center, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
          `).run(person.name, person.job_title, person.cost_center, person.status);
        } catch (error) {
          console.error('Error inserting demo person:', error);
        }
      }
      
      // Insert demo vehicles
      const vehicles = [
        { plate_number: 'ABC-123', vehicle_type: 'Truck', status: 'active' },
        { plate_number: 'XYZ-789', vehicle_type: 'Van', status: 'active' },
        { plate_number: 'DEF-456', vehicle_type: 'Truck', status: 'maintenance' }
      ];
      
      for (const vehicle of vehicles) {
        try {
          this.db.prepare(`
            INSERT INTO vehicles (plate_number, vehicle_type, status, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
          `).run(vehicle.plate_number, vehicle.vehicle_type, vehicle.status);
        } catch (error) {
          console.error('Error inserting demo vehicle:', error);
        }
      }
      
      // Get the IDs for linking
      const johnId = this.db.prepare("SELECT id FROM people WHERE name = 'John Smith'").get()?.id;
      const emmaId = this.db.prepare("SELECT id FROM people WHERE name = 'Emma Johnson'").get()?.id;
      const michaelId = this.db.prepare("SELECT id FROM people WHERE name = 'Michael Brown'").get()?.id;
      
      const truck1Id = this.db.prepare("SELECT id FROM vehicles WHERE plate_number = 'ABC-123'").get()?.id;
      const vanId = this.db.prepare("SELECT id FROM vehicles WHERE plate_number = 'XYZ-789'").get()?.id;
      const truck2Id = this.db.prepare("SELECT id FROM vehicles WHERE plate_number = 'DEF-456'").get()?.id;
      
      // Insert demo rounds
      if (johnId && truck1Id) {
        this.db.prepare(`
          INSERT INTO rounds (name, date, driver_id, vehicle_id, start_time, end_time, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run('Morning Delivery', '2023-05-15', johnId, truck1Id, '08:00', '12:30', 'completed');
      }
      
      if (emmaId && vanId) {
        this.db.prepare(`
          INSERT INTO rounds (name, date, driver_id, vehicle_id, start_time, end_time, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run('Afternoon Route', '2023-05-15', emmaId, vanId, '13:00', '17:30', 'completed');
      }
      
      if (michaelId && truck2Id) {
        this.db.prepare(`
          INSERT INTO rounds (name, date, driver_id, vehicle_id, start_time, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run('City Delivery', '2023-05-16', michaelId, truck2Id, '09:00', 'in_progress');
      }
      
      // Insert demo alerts
      if (truck1Id) {
        this.db.prepare(`
          INSERT INTO stop_events_alert (vehicle_id, alert_type, location, timestamp, duration, status, details, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(truck1Id, 'extended_stop', 'Downtown Helsinki', '2023-05-15 10:30:00', 45, 'new', 'Vehicle stopped for extended period');
      }
      
      if (vanId) {
        this.db.prepare(`
          INSERT INTO stop_events_alert (vehicle_id, alert_type, location, timestamp, duration, status, details, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(vanId, 'unexpected_stop', 'Espoo Mall', '2023-05-15 14:15:00', 30, 'acknowledged', 'Unscheduled stop detected');
      }
      
      // Commit transaction
      this.db.exec('COMMIT');
      console.log("Demo data inserted successfully");
      return true;
    } catch (error) {
      // Rollback transaction on error
      this.db.exec('ROLLBACK');
      console.error('Error inserting demo data:', error);
      return false;
    }
  }
}

module.exports = DriverAlertsDatabase; 