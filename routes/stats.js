const express = require("express");
const router = express.Router();
const stats = require("../controllers/statsController");
// Collecte anonyme : corps minuscule uniquement
router.post("/visite", express.json({ limit: "2kb" }), stats.collecter);
module.exports = router;
