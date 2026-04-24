const express = require('express');
const {
  listVehicleBrands,
  listVehicleModels,
  listVehicles,
} = require('../controllers/vehicles.controller');

const router = express.Router();

router.get('/vehicle-brands', listVehicleBrands);
router.get('/vehicle-models', listVehicleModels);
router.get('/vehicles', listVehicles);

module.exports = router;
