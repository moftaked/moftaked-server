import bcrypt from 'bcrypt';
import { User, RefreshTokenRow } from '../types';
import { executeQuery } from './database.service';
import jwt from 'jsonwebtoken';
import { Roles } from '../enums/roles.enum';
import rolesService from './roles.service';
import accountsService from './accounts.service';
import { Err, Ok } from 'result2';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let jwtSecret: string;
let jwtPrivateKey: string;
let jwtPublicKey: string;

const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function init(secret: string) {
  jwtSecret = secret;
  const privateKeyPath = process.env['JWT_PRIVATE_KEY_PATH'];
  const publicKeyPath = process.env['JWT_PUBLIC_KEY_PATH'];
  const defaultPrivateKeyPath = path.resolve(__dirname, '../../private-key.pem');
  const defaultPublicKeyPath = path.resolve(__dirname, '../../public-key.pem');

  if (privateKeyPath && publicKeyPath) {
    jwtPrivateKey = fs.readFileSync(path.resolve(privateKeyPath), 'utf8');
    jwtPublicKey = fs.readFileSync(path.resolve(publicKeyPath), 'utf8');
  } else if (fs.existsSync(defaultPrivateKeyPath) && fs.existsSync(defaultPublicKeyPath)) {
    jwtPrivateKey = fs.readFileSync(defaultPrivateKeyPath, 'utf8');
    jwtPublicKey = fs.readFileSync(defaultPublicKeyPath, 'utf8');
  }
}

async function signIn(username: string, password: string) {
  const now = Date.now();
  const attempt = failedLoginAttempts.get(username);
  if (attempt && attempt.lockedUntil > now) {
    return Err(StatusCodes.TOO_MANY_REQUESTS);
  }

  const userTableResults = await executeQuery<User[]>(
    'select account_id, username, password, real_name from accounts where username = ?',
    [username],
  );
  if (!userTableResults[0]) return Err(StatusCodes.UNAUTHORIZED);
  const user = userTableResults[0];
  if ((await compare(password, user.password)) === false) {
    const current = failedLoginAttempts.get(username) ?? { count: 0, lockedUntil: 0 };
    const newCount = current.count + 1;
    if (newCount >= MAX_FAILED_ATTEMPTS) {
      failedLoginAttempts.set(username, { count: newCount, lockedUntil: now + LOCKOUT_DURATION_MS });
    } else {
      failedLoginAttempts.set(username, { count: newCount, lockedUntil: 0 });
    }
    return Err(StatusCodes.UNAUTHORIZED);
  }

  failedLoginAttempts.delete(username);

  const isAdminAccount = await accountsService.isAdmin(user.account_id);
  const roles = isAdminAccount
    ? [{ class_id: 0, role: Roles.admin, school_id: 0 }]
    : await rolesService.getRoles(user.account_id);
  const payload = { sub: user.account_id, username: user.username };

  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await executeQuery(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.account_id, tokenHash, expiresAt],
  );

  return Ok({
    access_token: generateAccessToken(payload),
    refresh_token: refreshToken,
    user_id: user.account_id,
    is_admin: isAdminAccount,
    roles: JSON.stringify(roles),
  });
}

async function refreshToken(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);

  const rows = await executeQuery<RefreshTokenRow[]>(
    'SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?',
    [tokenHash],
  );

  if (!rows[0]) return Err(StatusCodes.UNAUTHORIZED);
  const stored = rows[0];

  if (stored.revoked_at) return Err(StatusCodes.UNAUTHORIZED);

  if (new Date(stored.expires_at) < new Date()) return Err(StatusCodes.UNAUTHORIZED);

  const userRows = await executeQuery<User[]>(
    'SELECT account_id, username FROM accounts WHERE account_id = ?',
    [stored.user_id],
  );
  if (!userRows[0]) return Err(StatusCodes.UNAUTHORIZED);
  const user = userRows[0];

  await executeQuery(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?',
    [stored.id],
  );

  const newRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await executeQuery(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.account_id, newTokenHash, expiresAt],
  );

  const payload = { sub: user.account_id, username: user.username };
  return Ok({
    access_token: generateAccessToken(payload),
    refresh_token: newRefreshToken,
  });
}

async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);

  const rows = await executeQuery<RefreshTokenRow[]>(
    'SELECT id FROM refresh_tokens WHERE token_hash = ?',
    [tokenHash],
  );

  if (!rows[0]) return Ok({ revoked: false });

  await executeQuery(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?',
    [rows[0].id],
  );

  return Ok({ revoked: true });
}

async function ensureRefreshTokensTable() {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME NULL,
      INDEX idx_token_hash (token_hash),
      INDEX idx_user_id (user_id),
      FOREIGN KEY (user_id) REFERENCES accounts(account_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

async function compare(password: string, hashed: string) {
  const res = await bcrypt.compare(password, hashed);
  return res;
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(payload: unknown) {
  if (jwtPrivateKey) {
    return jwt.sign({ payload }, jwtPrivateKey, {
      expiresIn: '5m',
      algorithm: 'ES256',
    });
  }
  return jwt.sign({ payload }, jwtSecret, {
    expiresIn: '5m',
    algorithm: 'HS256',
  });
}

function verify(token: string) {
  if (jwtPublicKey) {
    return jwt.verify(token, jwtPublicKey, {
      algorithms: ['ES256'],
    }) as jwt.JwtPayload;
  }
  return jwt.verify(token, jwtSecret, {
    algorithms: ['HS256'],
  }) as jwt.JwtPayload;
}

async function isInAnyClass(
  userId: number,
  classIds: number[],
  authorizedRoles: Roles[],
) {
  if (await isAdmin(userId)) return true;
  const roles = await rolesService.getRoles(userId, classIds);
  return roles.some(role => {
    return (
      classIds.includes(role['class_id']) &&
      authorizedRoles.some(authorizedRole => authorizedRole === role['role'])
    );
  });
}

async function hasRole(userId: number, requiredRoles: Roles[]) {
  if (await isAdmin(userId)) return true;
  const roles = await rolesService.getRoles(userId);
  return roles
  .some(userRole => requiredRoles
    .some(requiredRole => userRole['role'] === requiredRole));
}

async function isManagerOfClass(userId: number, classId: number) {
  if (await isAdmin(userId)) return true;
  const roles = await rolesService.getRoles(userId, [classId]);
  return roles.some(role => role['role'] === Roles.manager);
}

async function isManagerOfSchool(userId: number, schoolId: number) {
  if (await isAdmin(userId)) return true;
  const roles = await rolesService.getRoles(userId, undefined, schoolId);
  return roles.some(role => role['role'] === Roles.manager);
}

async function isAdmin(userId: number) {
  return accountsService.isAdmin(userId);
}

export default { signIn, refreshToken, logout, ensureRefreshTokensTable, init, verify, isInAnyClass, hasRole, isManagerOfClass, isManagerOfSchool, isAdmin };
