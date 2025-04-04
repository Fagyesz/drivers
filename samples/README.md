# Sample Excel Files

This directory contains sample Excel files for testing the import functionality of the Driver Alerts application.

## Files

1. **sample_people.xlsx** - Contains sample people/drivers data
2. **sample_vehicles.xlsx** - Contains sample vehicles data
3. **sample_rounds.xlsx** - Contains sample rounds data with merged cells

## Sample Data Structure

### sample_people.xlsx
* Contains basic information about drivers and staff
* Includes: Name, Role, Cost Center, Phone, Email, License Type, Status

### sample_vehicles.xlsx
* Contains basic information about vehicles
* Includes: Plate Number, Weight, Pack Time, Type, Status, Max Capacity

### sample_rounds.xlsx
* Contains complex round information with merged cells
* Demonstrates the application's ability to handle challenging Excel structures
* Includes: Date, Driver, Plate Number, Round details, Timings

## Usage

1. Start the Driver Alerts application
2. Go to the "Import Data" tab
3. Select one of these sample files
4. Preview the data and map the fields
5. Import the data to test the functionality

## Creating Your Own Test Files

If you need to create additional test files with merged cells, consider the following:

1. Use Excel to create a new file
2. Create your header row
3. For merged cell examples:
   - Select multiple cells
   - Right-click and select "Merge Cells"
   - Enter data in the merged cell
4. Save the file in .xlsx format
5. Place it in this directory for easy access
