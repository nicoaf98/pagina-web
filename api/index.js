// Vercel Functions entry. Reuses the same Express app used in local dev.
// No app.listen here: Vercel handles the HTTP layer.
module.exports = require('../backend/src/app');
