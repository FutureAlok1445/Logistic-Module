import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/error-handler';
import { env } from './config/env';
import v1Router from './routes/v1';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV });
});

// API Routes
app.use('/api/v1', v1Router);

app.use(errorHandler);

export default app;