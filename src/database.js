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
          plate_number TEXT NOT NULL,
          arrival_time TEXT NOT NULL,
          status TEXT,
          position TEXT,
          important_point TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
      sys_web_temp: `
        CREATE TABLE IF NOT EXISTS sys_web_temp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          jobtitle TEXT,
          costcenter TEXT,
          date TEXT NOT NULL,
          planedshift TEXT,
          actual TEXT,
          check_in TEXT,
          check_out TEXT,
          workedTime TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `,
      staging_ifleet: `
        CREATE TABLE IF NOT EXISTS staging_ifleet (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platenumber TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          area_name TEXT,
          direction TEXT,
          time_spent INTEGER,
          distance REAL,
          processed BOOLEAN DEFAULT 0,
          import_date TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
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
        
        // After creating stop_events_alert table, check if arrival_time column exists
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
      const hasArrivalTime = tableInfo.some(col => col.name === 'arrival_time');
      
      if (!hasArrivalTime) {
        console.warn("Adding missing arrival_time column to stop_events_alert table");
        // Add the missing column with a string default instead of CURRENT_TIMESTAMP
        this.db.exec(`ALTER TABLE stop_events_alert ADD COLUMN arrival_time TEXT DEFAULT ''`);
      }
      
      // Check for important_point column
      const hasImportantPoint = tableInfo.some(col => col.name === 'important_point');
      if (!hasImportantPoint) {
        console.warn("Adding missing important_point column to stop_events_alert table");
        this.db.exec(`ALTER TABLE stop_events_alert ADD COLUMN important_point TEXT DEFAULT ''`);
      } else {
        // Check if type needs to be changed from INTEGER to TEXT
        const importantPointType = tableInfo.find(col => col.name === 'important_point')?.type;
        if (importantPointType && importantPointType.toUpperCase() === 'INTEGER') {
          console.warn("Converting important_point column from INTEGER to TEXT");
          this.db.exec(`
            -- Create temporary table
            CREATE TABLE temp_stop_events_alert AS SELECT * FROM stop_events_alert;
            -- Drop original table
            DROP TABLE stop_events_alert;
            -- Recreate table with TEXT type for important_point
            CREATE TABLE stop_events_alert (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              plate_number TEXT NOT NULL,
              arrival_time TEXT NOT NULL,
              status TEXT,
              position TEXT,
              important_point TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            -- Copy data back
            INSERT INTO stop_events_alert 
            SELECT id, plate_number, arrival_time, status, position, CAST(important_point AS TEXT), created_at, updated_at 
            FROM temp_stop_events_alert;
            -- Drop temp table
            DROP TABLE temp_stop_events_alert;
          `);
        }
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
  getVehicleRounds(platenumber) {
    try {
      let query = `
        SELECT r.*, v.plate_number
        FROM rounds r
        JOIN vehicles v ON r.vehicle_id = v.id
      `;
      
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

  // Create an alert
  async createAlert(alertData) {
    try {
      const query = `
        INSERT INTO stop_events_alert (
          plate_number, arrival_time, status, position, important_point, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
      
      const result = this.db.prepare(query).run(
        alertData.plate_number,
        alertData.arrival_time,
        alertData.status,
        alertData.position,
        alertData.important_point || 0
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

  // Update alert important flag
  async updateAlertImportant(id, isImportant) {
    try {
      const query = `
        UPDATE stop_events_alert 
        SET important_point = ?,
            updated_at = datetime('now') 
        WHERE id = ?
      `;
      return this.db.prepare(query).run(isImportant ? 1 : 0, id);
    } catch (error) {
      console.error('Error updating alert important flag:', error);
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
      // First check if the table exists and has the arrival_time column
      try {
        const tableInfo = this.db.prepare(`PRAGMA table_info(stop_events_alert)`).all();
        const hasArrivalTime = tableInfo.some(col => col.name === 'arrival_time');
        
        if (!hasArrivalTime) {
          console.warn("stop_events_alert table doesn't have arrival_time column, returning empty array");
          return [];
        }
        
        const query = `
          SELECT * FROM stop_events_alert 
          ORDER BY arrival_time DESC
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
          INSERT INTO stop_events_alert (plate_number, arrival_time, status, position, important_point, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run('ABC-123', '2023-05-15 10:30:00', 'H', 'Downtown Helsinki', 1);
      }
      
      if (vanId) {
        this.db.prepare(`
          INSERT INTO stop_events_alert (plate_number, arrival_time, status, position, important_point, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run('XYZ-789', '2023-05-15 14:15:00', 'H', 'Espoo Mall', 0);
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

  // Import SysWeb Excel data
  async importSysWebData(records) {
    const result = { success: 0, errors: 0, total: records.length };
    
    if (!records || records.length === 0) {
      return result;
    }
    
    try {
      console.log(`Importing ${records.length} SysWeb records to database`);
      
      // Begin transaction
      const transaction = this.db.transaction((data) => {
        // First clear existing data
        console.log('Clearing existing data from sys_web_temp table');
        this.db.prepare(`DELETE FROM sys_web_temp`).run();
        
        // Insert new records
        const stmt = this.db.prepare(`
          INSERT INTO sys_web_temp (
            name, jobtitle, costcenter, date, planedshift, actual,
            check_in, check_out, workedTime, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        
        for (const record of data) {
          try {
            // Clean and format data
            const cleanRecord = {
              name: record.name || '',
              jobtitle: record.jobtitle || '',
              costcenter: record.costcenter || '',
              date: this.formatDate(record.date),
              planedshift: record.planedshift || '',
              actual: record.actual || '',
              check_in: record.check_in || '',
              check_out: record.check_out || '',
              workedTime: record.workedTime || ''
            };
            
            console.log('Inserting record:', cleanRecord);
            
            stmt.run(
              cleanRecord.name,
              cleanRecord.jobtitle,
              cleanRecord.costcenter,
              cleanRecord.date,
              cleanRecord.planedshift,
              cleanRecord.actual,
              cleanRecord.check_in,
              cleanRecord.check_out,
              cleanRecord.workedTime
            );
            result.success++;
          } catch (error) {
            console.error('Error inserting SysWeb record:', error, record);
            result.errors++;
          }
        }
      });
      
      // Execute transaction
      transaction(records);
      
      console.log('Import completed with result:', result);
      return result;
    } catch (error) {
      console.error('Error importing SysWeb data:', error);
      throw error;
    }
  }

  // Helper method to format dates consistently
  formatDate(date) {
    if (!date) return '';
    
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // Try to handle various date formats
    try {
      // Format like 2023.03.01
      if (typeof date === 'string' && date.includes('.')) {
        // Replace dots with dashes for SQL compatibility
        return date.replace(/(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3');
      }
      
      // If it's a Date object
      if (date instanceof Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      // If all else fails, return as is
      return date;
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return date; // Return as is on error
    }
  }

  // Get SysWeb data
  async getSysWebData() {
    try {
      const query = `
        SELECT * FROM sys_web_temp
        ORDER BY date
      `;
      return this.db.prepare(query).all();
    } catch (error) {
      console.error('Error getting SysWeb data:', error);
      throw error;
    }
  }

  // Import alert data from Excel
  async importAlertData(records) {
    const now = new Date().toISOString();
    let stmt;
    
    try {
      // Clear the table first
      this.db.exec(`DELETE FROM stop_events_alert`);
      
      // Create a prepared statement
      stmt = this.db.prepare(`
        INSERT INTO stop_events_alert 
        (plate_number, arrival_time, status, position, important_point, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      // Begin transaction
      this.db.exec('BEGIN TRANSACTION');
      
      let successCount = 0;
      let errorCount = 0;
      
      records.forEach(record => {
        try {
          // Keep important_point as the original string from Excel
          stmt.run(
            record.plate_number,
            record.arrival_time,
            record.status,
            record.position,
            record.important_point,  // Store as a string, not converted to 0/1
            now
          );
          successCount++;
        } catch (error) {
          console.error(`Error importing alert: ${error.message}`);
          errorCount++;
        }
      });
      
      // Commit transaction
      this.db.exec('COMMIT');
      
      return {
        success: successCount,
        errors: errorCount,
        total: records.length
      };
    } catch (error) {
      console.error('Error in importAlertData:', error);
      if (this.db.inTransaction) {
        this.db.exec('ROLLBACK');
      }
      throw error;
    }
  }

  // Get important alerts
  async getImportantAlerts() {
    try {
      console.log("Getting important alerts from stop_events_alert table");
      const query = `
        SELECT * FROM stop_events_alert 
        WHERE important_point = 1
        ORDER BY arrival_time DESC
      `;
      return this.db.prepare(query).all();
    } catch (error) {
      console.error('Error fetching important alerts:', error);
      return [];
    }
  }

  // Import iFleet data from Excel
  async importIFleetData(data) {
    const now = new Date().toISOString();
    const importDate = now.split('T')[0];
    let stmt;
    
    try {
      // Create a prepared statement
      stmt = this.db.prepare(`
        INSERT INTO staging_ifleet 
        (platenumber, timestamp, area_name, direction, time_spent, distance, import_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Begin transaction
      this.db.exec('BEGIN TRANSACTION');
      
      let successCount = 0;
      let errorCount = 0;
      
      data.forEach(item => {
        try {
          stmt.run(
            item.platenumber,
            item.timestamp,
            item.area_name,
            item.direction,
            item.time_spent,
            item.distance,
            importDate,
            now,
            now
          );
          successCount++;
        } catch (error) {
          console.error(`Error importing iFleet data: ${error.message}`);
          errorCount++;
        }
      });
      
      // Commit transaction
      this.db.exec('COMMIT');
      
      // Also create vehicle records for any new plate numbers
      this.createVehiclesFromPlateNumbers(data);
      
      return {
        success: successCount,
        errors: errorCount,
        total: data.length
      };
      
    } catch (error) {
      console.error('Error in importIFleetData:', error);
      if (this.db.inTransaction) {
        this.db.exec('ROLLBACK');
      }
      throw error;
    }
  }
  
  // Create vehicle records for plate numbers that don't exist
  async createVehiclesFromPlateNumbers(data) {
    try {
      // Get unique plate numbers from the data
      const plateNumbers = [...new Set(data.map(item => item.platenumber))];
      
      // Define regex patterns for valid plate numbers
      const plateNumberPattern = /^[A-Z]{2,3}-[A-Z0-9]{2,4}-\d{2,3}$|^[A-Z]{1,3}-[A-Z0-9]{2,3}-\d{2,3}$|^[A-Z]{2,3}-[A-Z0-9]{2,3}$|^[A-Z]{3}-\d{3}$/;
      
      // Filter out invalid plate numbers
      const validPlateNumbers = plateNumbers.filter(plate => {
        // Skip known header values
        if (!plate || 
            plate.toLowerCase().includes('rendszám') || 
            plate.toLowerCase().includes('terület') || 
            plate.toLowerCase().includes('telephely')) {
          return false;
        }
        
        // Check if it looks like a valid plate number
        return plateNumberPattern.test(plate) || 
               (plate.includes('-') && plate.length >= 5 && plate.length <= 10);
      });
      
      console.log(`Found ${validPlateNumbers.length} valid plate numbers out of ${plateNumbers.length}`);
      
      for (const plate of validPlateNumbers) {
        // Check if vehicle already exists
        const existingVehicle = this.db.prepare(`
          SELECT id FROM vehicles WHERE plate_number = ?
        `).get(plate);
        
        if (!existingVehicle) {
          // Insert new vehicle
          this.db.prepare(`
            INSERT INTO vehicles (plate_number, vehicle_type, status, notes, created_at, updated_at)
            VALUES (?, 'unknown', 'active', 'Automatically created from iFleet import', datetime('now'), datetime('now'))
          `).run(plate);
          
          console.log(`Created new vehicle with plate number: ${plate}`);
        }
      }
    } catch (error) {
      console.error('Error creating vehicles from plate numbers:', error);
    }
  }
  
  // Get iFleet data
  async getIFleetData() {
    try {
      const query = `
        SELECT * FROM staging_ifleet
        ORDER BY timestamp DESC
      `;
      
      return this.db.prepare(query).all();
    } catch (error) {
      console.error('Error getting iFleet data:', error);
      throw error;
    }
  }

  // Get alerts with optional filtering
  async getAlerts(plateNumber = null, fromDate = null, toDate = null, onlyImportant = false) {
    // Implementation of getAlerts method
  }
}

module.exports = DriverAlertsDatabase; 