import Redis from "ioredis";
const redis = new Redis({
  password: process.env.IOREDIS,
});

export default redis;
