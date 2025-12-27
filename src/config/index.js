import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './swipe.db',
  storagePath: process.env.STORAGE_PATH || './storage/photos',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  migrationEnabled: process.env.MIGRATION_ENABLED === 'true',
};

// Validate required configuration
if (config.nodeEnv === 'production') {
  if (!process.env.DATABASE_PATH) {
    throw new Error('DATABASE_PATH is required in production');
  }
  if (!process.env.STORAGE_PATH) {
    throw new Error('STORAGE_PATH is required in production');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-in-production') {
    throw new Error('JWT_SECRET must be set in production');
  }
}
