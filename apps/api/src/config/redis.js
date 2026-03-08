import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
    console.error('Redis error:', err.message);
});

export default redis;
