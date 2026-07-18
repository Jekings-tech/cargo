const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { authenticateUser } = require('../middleware/auth');

router.get('/tracking/:trackingId', shipmentController.getShipmentByTrackingId);

router.use(authenticateUser);

router.get('/stats', shipmentController.getDashboardStats);
router.get('/recent', shipmentController.getRecentShipments);

router.get('/', shipmentController.getAllShipments);
router.get('/:id', shipmentController.getShipmentById);
router.post('/', shipmentController.createShipment);
router.put('/:id', shipmentController.updateShipment);
router.delete('/:id', shipmentController.deleteShipment);

router.post('/:trackingId/tracking', shipmentController.addTrackingUpdate);

module.exports = router;