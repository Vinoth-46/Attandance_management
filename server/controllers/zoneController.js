const Zone = require('../models/Zone');

// Get all zones for logged-in staff
exports.getZones = async (req, res) => {
    try {
        const zones = await Zone.find({ createdBy: req.user.id }).sort({ name: 1 });
        res.json(zones);
    } catch (error) {
        console.error('Get zones error:', error);
        res.status(500).json({ message: 'Failed to fetch zones' });
    }
};

// Create a new zone
exports.createZone = async (req, res) => {
    try {
        const { name, latitude, longitude, radius } = req.body;

        if (!name || !latitude || !longitude) {
            return res.status(400).json({ message: 'Name, latitude, and longitude are required' });
        }

        const zone = await Zone.create({
            name,
            latitude,
            longitude,
            radius: radius || 50,
            createdBy: req.user.id
        });

        res.status(201).json(zone);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A zone with this name already exists' });
        }
        console.error('Create zone error:', error);
        res.status(500).json({ message: 'Failed to create zone' });
    }
};

// Delete a zone
exports.deleteZone = async (req, res) => {
    try {
        const zone = await Zone.findOneAndDelete({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!zone) {
            return res.status(404).json({ message: 'Zone not found' });
        }

        res.json({ message: 'Zone deleted successfully' });
    } catch (error) {
        console.error('Delete zone error:', error);
        res.status(500).json({ message: 'Failed to delete zone' });
    }
};
