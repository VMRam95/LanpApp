import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { lanpasRouter } from './routes/lanpas.routes.js';
import { gamesRouter } from './routes/games.routes.js';
import { punishmentsRouter } from './routes/punishments.routes.js';
import { nominationsRouter } from './routes/nominations.routes.js';
import { statsRouter } from './routes/stats.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
}

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/lanpas', lanpasRouter);
app.use('/api/games', gamesRouter);
app.use('/api/punishments', punishmentsRouter);
app.use('/api/nominations', nominationsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/notifications', notificationsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    statusCode: 404,
  });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});

export default app;
