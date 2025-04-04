I need to build an Electron application that imports data from various Excel files into SQLite database tables. The Excel files have inconsistent formats with particularly challenging merged cell structures that need special handling. Headers may not always start at the top of the sheet.

Please help me design and implement this application with the following core features:

1. DATA EXTRACTION & HANDLING:
   - Parse Excel files with complex merged cells across rows and columns
   - Implement strategies for resolving merged cell values to proper table structure
   - Support flexible header row detection at any position in the sheet
   - Map extracted data to SQLite schemas with data type validation
   - Handle inconsistent date formats and number representations

2. DATABASE SCHEMA DESIGN:
   - People: id, name, role, costcenter, phone, email, license_type, status
   - Vehicles: id, platenumber, weight, packtime, type, status, max_capacity
   - Addresses: id, district, city, postal_code, notes, delivery_restrictions
   - Rounds: id, date, day, köridő (planned round time), addresses (multiple districts), platenumber, driver, addressCounts, OverallWeight, RoundStart, RoundEnd, Packtime, WorktimeStart, WorktimeEnd, SavedTime (RoundEnd+packtime-WorktimeEnd), DeltaDriveTime (difference between köridő and actual round time)
   - VehicleAssignments: id, vehicle_id, driver_id, start_date, end_date, assignment_type (regular/temporary), approved_by
   - TimeRecords: id, driver_id, date, check_in_time, check_out_time, total_hours, overtime_hours, notes
   - StopEventsAlert: id, platenumber, arrival_time, standing_duration, ignition_status, position, important_point
   - Settings: key, value (for application configuration)

3. BUSINESS LOGIC:
   - Driver workflow tracking:
     * Check-in → Wait packtime duration → Start round (RoundStart)
     * End round (RoundEnd) → Wait packtime duration → Check-out (WorktimeEnd)
   - Alert system for exceeded packtime values with red color highlighting
   - 30-minute stopping alerts based on vehicle data
   - Data validation rules and business constraints
   - Vehicle assignment tracking and history

4. UI IMPLEMENTATION:
   - Modern Windows 11 style UI design 
   - User-friendly interface with intuitive navigation
   - Excel data import interface with preview and mapping capabilities
   - Data visualization dashboard
   - Alert management system
   - CRUD operations for all tables
   - Interactive data grid with sorting and filtering
   - Reporting interface with exportable results

5. APPLICATION CONFIGURATION:
   - Allow user to set and change SQLite database location
   - Save configuration settings persistently
   - Handle database connection errors gracefully
   - Excel mapping templates for recurring import formats

6. VERSION CONTROL & DEPLOYMENT:
   - Git repository setup with recommended branch structure
   - .gitignore file for proper exclusion of build artifacts and dependencies
   - Automated build process for creating Windows executable (.exe)
   - Installer creation for easy deployment

7. ADDITIONAL CONSIDERATIONS:
   - Proper error logging and crash reporting
   - Data backup and restore functionality
   - Performance optimization for large Excel files
   - Memory management for handling large Excel files
   - Data import/export functionality
   - Audit trail for data changes
   - Historical data analysis and visualization

Please provide detailed technical guidance on:
- Optimal Electron architecture for this application
- Advanced Excel parsing strategies for complex merged cell scenarios
- Visual preview system for Excel import with cell mapping interface
- SQLite schema design with proper relationships and indexing strategy
- Efficient queries for time-based calculations and vehicle-driver assignments
- UI components following Windows 11 design language
- Implementation using Cursor for coding assistance
- Git workflow best practices for this project
- Electron-builder or similar tool configuration for creating an optimized executable
- Best practices for error handling and data validation
- Unit and integration testing approaches
- Database migration strategies for future schema updates

Include sample code where appropriate for the most critical components, especially for the Excel parsing with merged cells handling and the relationship between drivers and vehicles over specific timeframes.