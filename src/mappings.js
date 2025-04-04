const moment = require('moment');

/**
 * Excel to database mappings with field transformations
 */
const mappings = {
    // Mapping for people/drivers
    people: {
        name: 'Name',
        role: {
            field: 'Role',
            transform: (value) => value || 'driver'
        },
        costcenter: 'CostCenter',
        phone: 'Phone',
        email: 'Email',
        license_type: 'LicenseType',
        status: {
            field: 'Status',
            transform: (value) => value || 'active'
        }
    },
    
    // Mapping for vehicles
    vehicles: {
        platenumber: 'PlateNumber',
        weight: 'Weight',
        packtime: 'PackTime',
        type: 'Type',
        status: {
            field: 'Status',
            transform: (value) => value || 'active'
        },
        max_capacity: 'MaxCapacity'
    },
    
    // Mapping for addresses
    addresses: {
        district: 'District',
        city: 'City',
        postal_code: 'PostalCode',
        notes: 'Notes',
        delivery_restrictions: 'DeliveryRestrictions'
    },
    
    // Mapping for rounds
    rounds: {
        date: {
            field: 'Date',
            transform: (value) => {
                if (!value) return null;
                return moment(value).format('YYYY-MM-DD');
            }
        },
        day: {
            field: 'Date',
            transform: (value) => {
                if (!value) return null;
                return moment(value).format('dddd');
            }
        },
        planned_round_time: 'PlannedRoundTime',
        addresses: 'Addresses',
        platenumber: 'PlateNumber',
        driver_id: {
            field: 'DriverName',
            // This is a placeholder, the actual mapping requires a lookup
            transform: (value, item, context) => {
                if (!value) return null;
                // In real implementation, this would look up the driver ID by name
                // For now, it's a placeholder that assumes context has drivers
                const driver = context?.drivers?.find(d => d.name === value);
                return driver ? driver.id : null;
            }
        },
        address_counts: 'AddressCounts',
        overall_weight: 'OverallWeight',
        round_start: {
            field: 'RoundStart',
            transform: (value) => {
                if (!value) return null;
                return moment(value, ['HH:mm:ss', 'HH:mm', 'h:mm A']).format('HH:mm:ss');
            }
        },
        round_end: {
            field: 'RoundEnd',
            transform: (value) => {
                if (!value) return null;
                return moment(value, ['HH:mm:ss', 'HH:mm', 'h:mm A']).format('HH:mm:ss');
            }
        },
        packtime: 'PackTime',
        worktime_start: {
            field: 'WorktimeStart',
            transform: (value) => {
                if (!value) return null;
                return moment(value, ['HH:mm:ss', 'HH:mm', 'h:mm A']).format('HH:mm:ss');
            }
        },
        worktime_end: {
            field: 'WorktimeEnd',
            transform: (value) => {
                if (!value) return null;
                return moment(value, ['HH:mm:ss', 'HH:mm', 'h:mm A']).format('HH:mm:ss');
            }
        },
        saved_time: 'SavedTime',
        delta_drive_time: 'DeltaDriveTime'
    },
    
    // Mapping for vehicle assignments
    vehicle_assignments: {
        vehicle_id: {
            field: 'PlateNumber',
            // Placeholder for lookup
            transform: (value, item, context) => {
                if (!value) return null;
                const vehicle = context?.vehicles?.find(v => v.platenumber === value);
                return vehicle ? vehicle.id : null;
            }
        },
        driver_id: {
            field: 'DriverName',
            // Placeholder for lookup
            transform: (value, item, context) => {
                if (!value) return null;
                const driver = context?.drivers?.find(d => d.name === value);
                return driver ? driver.id : null;
            }
        },
        start_date: {
            field: 'StartDate',
            transform: (value) => {
                if (!value) return null;
                return moment(value).format('YYYY-MM-DD');
            }
        },
        end_date: {
            field: 'EndDate',
            transform: (value) => {
                if (!value) return null;
                return moment(value).format('YYYY-MM-DD');
            }
        },
        assignment_type: {
            field: 'AssignmentType',
            transform: (value) => {
                if (!value) return 'regular';
                return value.toLowerCase() === 'temporary' ? 'temporary' : 'regular';
            }
        },
        approved_by: 'ApprovedBy'
    },
    
    // Mapping for time records
    time_records: {
        driver_id: {
            field: 'DriverName',
            // Placeholder for lookup
            transform: (value, item, context) => {
                if (!value) return null;
                const driver = context?.drivers?.find(d => d.name === value);
                return driver ? driver.id : null;
            }
        },
        date: {
            field: 'Date',
            transform: (value) => {
                if (!value) return null;
                return moment(value).format('YYYY-MM-DD');
            }
        },
        check_in_time: {
            field: 'CheckInTime',
            transform: (value) => {
                if (!value) return null;
                return moment(value, ['HH:mm:ss', 'HH:mm', 'h:mm A']).format('HH:mm:ss');
            }
        },
        check_out_time: {
            field: 'CheckOutTime',
            transform: (value) => {
                if (!value) return null;
                return moment(value, ['HH:mm:ss', 'HH:mm', 'h:mm A']).format('HH:mm:ss');
            }
        },
        total_hours: 'TotalHours',
        overtime_hours: 'OvertimeHours',
        notes: 'Notes'
    },
    
    // Mapping for stop events
    stop_events_alert: {
        platenumber: 'PlateNumber',
        arrival_time: {
            field: 'ArrivalTime',
            transform: (value) => {
                if (!value) return null;
                return moment(value).format('YYYY-MM-DD HH:mm:ss');
            }
        },
        standing_duration: 'StandingDuration',
        ignition_status: 'IgnitionStatus',
        position: 'Position',
        important_point: {
            field: 'ImportantPoint',
            transform: (value) => {
                if (typeof value === 'string') {
                    return ['true', 'yes', '1', 'y'].includes(value.toLowerCase());
                }
                return Boolean(value);
            }
        }
    }
};

module.exports = mappings; 