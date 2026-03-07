import dotenv from 'dotenv';
import app from './src/app.js';
import connectDatabase from './src/config/database.js';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectEnvPath = path.join(__dirname, '..', '.env');
const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(projectEnvPath)) {
  dotenv.config({ path: projectEnvPath });
}

const PORT = process.env.PORT || 5000;
const isElectronDesktop = process.env.ELECTRON_DESKTOP === '1';

const start = async () => {
  if (isElectronDesktop) {
    // In desktop runtimes (especially MSIX), DB connect can be slow.
    // Start HTTP server immediately so renderer can load, then connect DB in background.
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    void connectDatabase().catch((error) => {
      console.warn(`Desktop background MongoDB connect failed: ${error.message}`);
    });
    return;
  }

  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
