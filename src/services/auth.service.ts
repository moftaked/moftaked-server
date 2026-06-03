import bcrypt from 'bcrypt';
import { User } from '../types';
import { executeQuery } from './database.service';
import jwt from 'jsonwebtoken';
import { Roles } from '../enums/roles.enum';
import rolesService from './roles.service';
import accountsService from './accounts.service';
import { Err, Ok } from 'result2';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';

let jwtSecret: string;
let jwtPrivateKey: string;
let jwtPublicKey: string;

const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

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
  return Ok({
    access_token: generateAccessToken(payload),
    user_id: user.account_id,
    is_admin: isAdminAccount,
    roles: JSON.stringify(roles),
  });
}

async function compare(password: string, hashed: string) {
  const res = await bcrypt.compare(password, hashed);
  return res;
}

function generateAccessToken(payload: unknown) {
  if (jwtPrivateKey) {
    return jwt.sign({ payload }, jwtPrivateKey, {
      expiresIn: '1h',
      algorithm: 'ES256',
    });
  }
  return jwt.sign({ payload }, jwtSecret, {
    expiresIn: '1h',
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
  const roles = await rolesService.getRoles(userId, classIds);
  return roles.some(role => {
    return (
      classIds.includes(role['class_id']) &&
      authorizedRoles.some(authorizedRole => authorizedRole === role['role'])
    );
  });
}

async function hasRole(userId: number, requiredRoles: Roles[]) {
  const roles = await rolesService.getRoles(userId);
  return roles
  .some(userRole => requiredRoles
    .some(requiredRole => userRole['role'] === requiredRole));
}

async function isManagerOfClass(userId: number, classId: number) {
  const roles = await rolesService.getRoles(userId, [classId]);
  return roles.some(role => role['role'] === Roles.manager);
}

async function isManagerOfSchool(userId: number, schoolId: number) {
  const roles = await rolesService.getRoles(userId, undefined, schoolId);
  return roles.some(role => role['role'] === Roles.manager);
}

async function isAdmin(userId: number) {
  return accountsService.isAdmin(userId);
}

export default { signIn, init, verify, isInAnyClass, hasRole, isManagerOfClass, isManagerOfSchool, isAdmin };
