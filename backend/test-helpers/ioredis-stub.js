// Minimal in-repo ioredis stub used for unit tests to avoid external dependency
class IORedisStub {
    constructor() {
        this.kv = new Map();
        this.sorted = new Map();
    }

    async ping() {
        return 'PONG';
    }

    async flushall() {
        this.kv.clear();
        this.sorted.clear();
        return 'OK';
    }

    // simple key-value
    async get(key) {
        return this.kv.has(key) ? String(this.kv.get(key)) : null;
    }

    async set(key, value) {
        this.kv.set(key, String(value));
        return 'OK';
    }

    async incr(key) {
        const cur = parseInt(this.kv.get(key) || '0', 10) || 0;
        const next = cur + 1;
        this.kv.set(key, String(next));
        return next;
    }

    // sorted set: store as array of {score, member}
    _ensureSorted(key) {
        if (!this.sorted.has(key)) this.sorted.set(key, []);
        return this.sorted.get(key);
    }

    async zadd(key, score, member) {
        const arr = this._ensureSorted(key);
        arr.push({ score: Number(score), member });
        // keep sorted by score asc
        arr.sort((a, b) => a.score - b.score);
        return arr.length;
    }

    async zremrangebyscore(key, min, max) {
        const arr = this._ensureSorted(key);
        const before = arr.length;
        const kept = arr.filter((e) => e.score < min || e.score > max);
        this.sorted.set(key, kept);
        return before - kept.length;
    }

    async zcard(key) {
        const arr = this._ensureSorted(key);
        return arr.length;
    }
}

module.exports = IORedisStub;
