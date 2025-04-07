/**
 * Database schema definitions with types and validations
 */
const schemas = {
    people: {
        id: {
            type: 'integer',
            autoIncrement: true
        },
        name: {
            type: 'string',
            required: true,
            validate: value => value && value.length > 0
        },
        role: {
            type: 'string',
            required: true
        },
        costcenter: {
            type: 'string'
        },
        phone: {
            type: 'string'
        },
        email: {
            type: 'string',
            validate: value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        },
        license_type: {
            type: 'string'
        },
        status: {
            type: 'string',
            default: 'active'
        },
        updated_at: {
            type: 'datetime',
            default: () => new Date().toISOString()
        }
    },
    
    vehicles: {
        id: {
            type: 'integer',
            autoIncrement: true
        },
        platenumber: {
            type: 'string',
            required: true,
            validate: value => value && value.length > 0
        },
        weight: {
            type: 'float'
        },
        packtime: {
            type: 'integer'
        },
        type: {
            type: 'string'
        },
        status: {
            type: 'string',
            default: 'active'
        },
        max_capacity: {
            type: 'float'
        },
        updated_at: {
            type: 'datetime',
            default: () => new Date().toISOString()
        }
    },
    
    addresses: {
        id: {
            type: 'integer',
            autoIncrement: true
        },
        district: {
            type: 'string',
            required: true
        },
        city: {
            type: 'string',
            required: true
        },
        postal_code: {
            type: 'string'
        },
        notes: {
            type: 'string'
        },
        delivery_restrictions: {
            type: 'string'
        },
        updated_at: {
            type: 'datetime',
            default: () => new Date().toISOString()
        }
    },
    
    rounds: {
        id: {
            type: 'integer',
            autoIncrement: true
        },
        date: {
            type: 'date',
            required: true
        },
        day: {
            type: 'string'
        },
        planned_round_time: {
            type: 'integer'
        },
        addresses: {
            type: 'string'
        },
        platenumber: {
            type: 'string'
        },
        driver_id: {
            type: 'integer'
        },
        address_counts: {
            type: 'integer'
        },
        overall_weight: {
            type: 'float'
        },
        round_start: {
            type: 'time'
        },
        round_end: {
            type: 'time'
        },
        packtime: {
            type: 'integer'
        },
        worktime_start: {
            type: 'time'
        },
        worktime_end: {
            type: 'time'
        },
        saved_time: {
            type: 'integer'
        },
        delta_drive_time: {
            type: 'integer'
        },
        updated_at: {
            type: 'datetime',
            default: () => new Date().toISOString()
        }
    },
    
    vehicle_assignments: {
        id: {
            type: 'integer',
            autoIncrement: true
        },
        vehicle_id: {
            type: 'integer',
            required: true
        },
        driver_id: {
            type: 'integer',
            required: true
        },
        start_date: {
            type: 'date',
            required: true
        },
        end_date: {
            type: 'date'
        },
        assignment_type: {
            type: 'string',
            required: true,
            validate: value => ['regular', 'temporary'].includes(value)
        },
        approved_by: {
            type: 'string'
        },
        updated_at: {
            type: 'datetime',
            default: () => new Date().toISOString()
        }
    },
    
    time_records: {
        id: {
            type: 'integer',
            autoIncrement: true
        },
        driver_id: {
            type: 'integer',
            required: true
        },
        date: {
            type: 'date',
            required: true
        },
        check_in_time: {
            type: 'time'
        },
        check_out_time: {
            type: 'time'
        },
        total_hours: {
            type: 'float'
        },
        overtime_hours: {
            type: 'float'
        },
        notes: {
            type: 'string'
        },
        updated_at: {
            type: 'datetime',
            default: () => new Date().toISOString()
        }
    },
    
    stop_events_alert: {
        id: {
            type: 'integer',
            autoIncrement: true
        },
        plate_number: {
            type: 'string',
            required: true
        },
        arrival_time: {
            type: 'datetime',
            required: true
        },
        status: {
            type: 'string'
        },
        position: {
            type: 'string'
        },
        important_point: {
            type: 'boolean',
            default: false
        },
        updated_at: {
            type: 'datetime',
            default: () => new Date().toISOString()
        }
    },
    
    settings: {
        key: {
            type: 'string',
            required: true
        },
        value: {
            type: 'string',
            required: true
        },
        updated_at: {
            type: 'datetime',
            default: () => new Date().toISOString()
        }
    }
};

module.exports = schemas; 