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
const mongodbUri = process.env.MONGODB_URI?.trim() || 'mongodb://localhost:27017/blackbox';
const clientUrl = process.env.CLIENT_URL?.trim() || 'http://localhost:5173';
const allowInsecureHttp = process.env.ALLOW_INSECURE_HTTP === 'true';
const isPlaceholderSecret = (value: string): boolean => /^(replace-with|change-me|your[-_]|example[-_])/i.test(value);

if (isProduction && (!jwtSecret || jwtSecret === unsafeDevelopmentSecret || jwtSecret.length < 32 || isPlaceholderSecret(jwtSecret))) {
  throw new Error('JWT_SECRET must be a secure value of at least 32 characters in production');
}

if (isProduction && !process.env.MONGODB_URI?.trim()) throw new Error('MONGODB_URI must be configured in production');
if (isProduction && !process.env.CLIENT_URL?.trim()) throw new Error('CLIENT_URL must be configured in production');

try {
  const parsedClientUrl = new URL(clientUrl);
  if (isProduction && parsedClientUrl.protocol !== 'https:' && !allowInsecureHttp) {
    throw new Error('CLIENT_URL must use HTTPS in production unless ALLOW_INSECURE_HTTP=true');
  }
} catch {
  throw new Error('CLIENT_URL must be an absolute URL');
}

const configuredOrigins = (process.env.CORS_ORIGINS || clientUrl)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (configuredOrigins.includes('*')) throw new Error('CORS_ORIGINS cannot contain *');

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongodbUri,
  jwtSecret: jwtSecret || unsafeDevelopmentSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl,
  corsOrigins: configuredOrigins,
  allowInsecureHttp,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  // Demo maintenance is opt-in and can never be enabled in production.
  enableDemoMode: !isProduction && process.env.ENABLE_DEMO_MODE === 'true',
};
