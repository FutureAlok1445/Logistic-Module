import { Queue } from 'bullmq';
import { redis } from './redis';

const connection = { host: 'localhost', port: 6379 };

export const dispatchQueue = new Queue('dispatch', { connection });
export const notificationQueue = new Queue('notifications', { connection });