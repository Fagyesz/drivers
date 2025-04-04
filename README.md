# Driver Alerts Application

An Electron-based application for importing complex Excel files into SQLite database tables, with a focus on driver and vehicle management, rounds tracking, and alerts.

## Features

- **Excel Import with Merged Cell Support**: Import data from Excel files with complex merged cell structures
- **SQLite Database Integration**: Store all data in a local SQLite database
- **Driver Management**: Track drivers, licenses, and assignments
- **Vehicle Tracking**: Manage vehicles and their assignments
- **Rounds Monitoring**: Track driver rounds, timings, and efficiency metrics
- **Alert System**: Receive alerts for stopped vehicles, exceeded packtimes, and other events
- **Modern Windows 11 UI**: Clean, responsive interface following Windows 11 design principles

## Installation

### Prerequisites

- Node.js 16.x or later
- npm 8.x or later

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/DriverAllerts.git
cd DriverAllerts
```

2. Install dependencies:
```bash
npm install
```

3. Run the application in development mode:
```bash
npm run dev
```

4. To build a production executable:
```bash
npm run dist
```

## Usage

### Importing Excel Data

1. Navigate to the "Import Data" tab
2. Select an Excel file using the file picker
3. Preview the data and check that the header row is correctly identified
4. Map Excel columns to database fields
5. Click "Import" to process the data

### Working with People/Drivers

- View all people in the system on the "People" tab
- Add new people using the "Add Person" button
- Edit or delete existing people using the action buttons

### Working with Vehicles

- View all vehicles in the system on the "Vehicles" tab
- Add new vehicles using the "Add Vehicle" button
- Edit or delete existing vehicles using the action buttons

### Managing Rounds

- View all rounds in the system on the "Rounds" tab
- Add new rounds manually or import them from Excel
- Track timing information and identify efficiency opportunities

### Alerts

- View all alerts in the system on the "Alerts" tab
- Get notifications for vehicle stops over 30 minutes
- Receive alerts for exceeded packtime values

### Settings

- Configure database location
- Set alert thresholds
- Manage backup and restore operations

## Development Status

### Completed

- ✅ Basic application structure with Electron
- ✅ SQLite database integration
- ✅ Excel parsing with merged cell support
- ✅ Data mapping and validation utilities
- ✅ Modern UI components and styles
- ✅ Database schema design

### In Progress

- 🔄 Import UI implementation
- 🔄 CRUD operations for all entities
- 🔄 Alert system functionality

### Planned

- 📅 Data visualization dashboard
- 📅 Advanced reporting features
- 📅 Export functionality
- 📅 Unit and integration tests
- 📅 Installer creation

## Architecture

The application follows a modular architecture:

- **main.js**: Electron main process, handles IPC communication
- **renderer.js**: UI logic and event handling
- **database.js**: SQLite database operations
- **src/excelParser.js**: Excel file parsing with merged cell support
- **src/dataMapper.js**: Data mapping and validation between Excel and database
- **src/mappingUI.js**: UI component for mapping Excel columns to database fields
- **src/schemas.js**: Database schema definitions
- **src/mappings.js**: Excel to database field mappings

## License

This project is licensed under the ISC License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 