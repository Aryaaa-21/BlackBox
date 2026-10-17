import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Prefer server/.env, while retaining support for starting from the repository
// root or from the server directory. The first existing file wins.
const envCandidates = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(process.cwd(), '.env'),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) dotenv.config({ path: envPath });

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET?.trim();
const unsafeDevelopmentSecret = 'dev_blackbox_fallback_jwt_secret_do_not_use_in_prod';

if (isProduction && (!jwtSecret || jwtSecret === unsafeDevelopmentSecret || jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be a secure value of at least 32 characters in production');
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/blackbox',
  jwtSecret: jwtSecret || unsafeDevelopmentSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  // Demo maintenance is opt-in and can never be enabled in production.
  enableDemoMode: !isProduction && process.env.ENABLE_DEMO_MODE === 'true',
};
