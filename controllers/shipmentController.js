const Shipment = require('../models/Shipment');
const axios = require('axios');

const geocodeLocation = async (location) => {
    try {
        if (!location) return null;
        
        const response = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json`,
            {
                params: {
                    access_token: process.env.MAPBOX_TOKEN,
                    limit: 1
                }
            }
        );
        
        if (response.data.features && response.data.features.length > 0) {
            const [lng, lat] = response.data.features[0].center;
            return { lat, lng };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error.message);
        return null;
    }
};

exports.getAllShipments = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.status) filter['shipmentInfo.status'] = req.query.status;
        if (req.query.shipmentType) filter['shipmentInfo.shipmentType'] = req.query.shipmentType;
        if (req.query.carrier) filter['shipmentInfo.carrier'] = req.query.carrier;
        if (req.query.search) {
            filter.$or = [
                { trackingId: { $regex: req.query.search, $options: 'i' } },
                { 'shipper.name': { $regex: req.query.search, $options: 'i' } },
                { 'recipient.name': { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const sort = {};
        if (req.query.sortBy) {
            sort[req.query.sortBy] = req.query.order === 'desc' ? -1 : 1;
        } else {
            sort.createdAt = -1;
        }

        const shipments = await Shipment.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const total = await Shipment.countDocuments(filter);

        res.json({
            shipments,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: limit
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getShipmentByTrackingId = async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ trackingId: req.params.trackingId });
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        res.json(shipment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getShipmentById = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        res.json(shipment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createShipment = async (req, res) => {
    try {
        const shipmentData = req.body;

        const [originCoords, currentCoords, destinationCoords] = await Promise.all([
            geocodeLocation(shipmentData.route.origin),
            geocodeLocation(shipmentData.route.currentLocation),
            geocodeLocation(shipmentData.route.destination)
        ]);

        const shipment = new Shipment({
            ...shipmentData,
            map: {
                originCoordinates: originCoords,
                currentCoordinates: currentCoords,
                destinationCoordinates: destinationCoords
            }
        });

        await shipment.save();
        res.status(201).json(shipment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateShipment = async (req, res) => {
    try {
        const shipmentData = req.body;
        const shipment = await Shipment.findById(req.params.id);
        
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        if (!shipmentData.map) {
            shipmentData.map = shipment.map || {
                originCoordinates: { lat: null, lng: null },
                currentCoordinates: { lat: null, lng: null },
                destinationCoordinates: { lat: null, lng: null }
            };
        }

        if (shipmentData.route) {
            if (shipmentData.route.origin && shipmentData.route.origin !== shipment.route.origin) {
                const coords = await geocodeLocation(shipmentData.route.origin);
                if (coords) shipmentData.map.originCoordinates = coords;
            }
            if (shipmentData.route.currentLocation && shipmentData.route.currentLocation !== shipment.route.currentLocation) {
                const coords = await geocodeLocation(shipmentData.route.currentLocation);
                if (coords) shipmentData.map.currentCoordinates = coords;
            }
            if (shipmentData.route.destination && shipmentData.route.destination !== shipment.route.destination) {
                const coords = await geocodeLocation(shipmentData.route.destination);
                if (coords) shipmentData.map.destinationCoordinates = coords;
            }
        }

        Object.assign(shipment, shipmentData);
        await shipment.save();
        
        res.json(shipment);
    } catch (error) {
        console.error('Error updating shipment:', error);
        res.status(400).json({ error: error.message });
    }
};

exports.deleteShipment = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        await shipment.deleteOne();
        res.json({ message: 'Shipment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addTrackingUpdate = async (req, res) => {
    try {
        const { trackingId } = req.params;
        const updateData = req.body;

        const shipment = await Shipment.findOne({ trackingId });
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        shipment.trackingHistory.push({
            status: updateData.status,
            location: updateData.location,
            comment: updateData.comment,
            date: updateData.date || new Date(),
            time: updateData.time || new Date().toLocaleTimeString('en-US', { hour12: false })
        });

        shipment.shipmentInfo.status = updateData.status;
        shipment.shipmentInfo.lastUpdated = new Date();

        if (updateData.location) {
            shipment.route.currentLocation = updateData.location;
            const coords = await geocodeLocation(updateData.location);
            if (coords) {
                shipment.map.currentCoordinates = coords;
            }
        }

        await shipment.save();
        res.json(shipment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const total = await Shipment.countDocuments();
        res.json({
            totalShipments: total
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getRecentShipments = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const shipments = await Shipment.find()
            .sort({ createdAt: -1 })
            .limit(limit);
        res.json(shipments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};