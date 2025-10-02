// Lightweight fetch helper: prefer global.fetch (Node 18+), otherwise use node-fetch v2
let fetchImpl;
try {
    if (typeof global.fetch === 'function') {
        fetchImpl = global.fetch;
    } else {
        // node-fetch v2 exports a function
        fetchImpl = require('node-fetch');
    }
} catch (e) {
    // no fetch available — throw when attempted to use
    fetchImpl = null;
}

module.exports = function fetchHelper(...args) {
    if (!fetchImpl) throw new Error('fetch is not available in this environment');
    return fetchImpl(...args);
};
