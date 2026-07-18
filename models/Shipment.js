const mongoose = require('mongoose');

const trackingUpdateSchema = new mongoose.Schema({
    status: {
        type: String,
        required: true,
        enum: [
            'Pending', 'Pickup Scheduled', 'Picked Up', 'In Transit',
            'At Facility', 'Customs Clearance', 'Out for Delivery',
            'Delivered', 'Delayed', 'On Hold', 'Exception',
            'Returned', 'Cancelled', 'Lost', 'Damaged'
        ]
    },
    location: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    time: {
        type: String,
        default: () => new Date().toLocaleTimeString('en-US', { hour12: false })
    },
    comment: {
        type: String,
        default: ''
    }
}, { _id: true });

const shipmentSchema = new mongoose.Schema({
    trackingId: {
        type: String,
        unique: true,
        required: true,
        default: function() {
            const prefix = 'TRK';
            const timestamp = Date.now().toString().slice(-8);
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            return `${prefix}${timestamp}${random}`;
        }
    },
    shipmentInfo: {
        status: {
            type: String,
            required: true,
            enum: [
                'Pending', 'Pickup Scheduled', 'Picked Up', 'In Transit',
                'At Facility', 'Customs Clearance', 'Out for Delivery',
                'Delivered', 'Delayed', 'On Hold', 'Exception',
                'Returned', 'Cancelled', 'Lost', 'Damaged'
            ],
            default: 'Pending'
        },
        carrier: {
            type: String,
            required: true
        },
        shipmentType: {
            type: String,
            required: true,
            enum: ['Road Freight', 'Air Freight', 'Ocean Freight', 'Rail Freight', 'Express Delivery']
        },
        estimatedDelivery: {
            type: Date,
            required: true
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        },
        comments: {
            type: String,
            default: ''
        }
    },
    shipper: {
        name: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        }
    },
    recipient: {
        name: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        }
    },
    route: {
        origin: {
            type: String,
            required: true
        },
        currentLocation: {
            type: String,
            required: true
        },
        destination: {
            type: String,
            required: true
        },
        pickupDate: {
            type: Date,
            required: true
        },
        pickupTime: {
            type: String,
            required: true
        },
        departureDate: {
            type: Date,
            required: true
        },
        departureTime: {
            type: String,
            required: true
        }
    },
    package: {
        packageType: {
            type: String,
            required: true
        },
        pieces: {
            type: Number,
            required: true,
            min: 1
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        weight: {
            type: Number,
            required: true,
            min: 0
        },
        dimensions: {
            type: String,
            required: true
        },
        description: {
            type: String,
            default: ''
        }
    },
    payment: {
        paymentMode: {
            type: String,
            required: true,
            enum: ['Cash', 'Bank Transfer', 'Mobile Money', 'Credit Card', 'Other']
        },
        freightCost: {
            type: Number,
            required: true,
            min: 0
        },
        paymentStatus: {
            type: String,
            required: true,
            enum: ['Pending', 'Paid', 'Partially Paid', 'Overdue']
        }
    },
    map: {
        originCoordinates: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null }
        },
        currentCoordinates: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null }
        },
        destinationCoordinates: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null }
        }
    },
    trackingHistory: [trackingUpdateSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

shipmentSchema.pre('save', function(next) {
    if (!this.trackingId || this.trackingId === '') {
        const prefix = 'TRK';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.trackingId = `${prefix}${timestamp}${random}`;
    }
    this.updatedAt = Date.now();
    next();
});

shipmentSchema.pre('save', function(next) {
    if (this.isNew && this.trackingHistory.length === 0) {
        this.trackingHistory.push({
            status: this.shipmentInfo.status || 'Pending',
            location: this.route.origin || 'Unknown',
            comment: 'Shipment created successfully'
        });
    }
    next();
});

module.exports = mongoose.model('Shipment', shipmentSchema);