import { app } from './app.js';
import { config } from './config/index.js';

// Start server (only for local development)
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});

export default app;
