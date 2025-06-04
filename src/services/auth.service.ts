import bcrypt from 'bcrypt';
import {User} from '../types';
import {executeQuery} from './database.service';
import jwt from 'jsonwebtoken';

let jwtSecret: string;

function init(secret: string) {
  jwtSecret = secret;
}

async function signIn(username: string, password: string) {
  const userTableResults = await executeQuery<User[]>(
    'select account_id, username, password, real_name from accounts where username = ?',
    [username],
  );
  if (!userTableResults[0]) throw new Error('user not found'); // todo: implement better error type
  const user = userTableResults[0];
  if ((await compare(password, user.password)) === false) {
    throw new Error('unauthorized'); // todo: implement better error type
  }
  const roles = await getRoles(user.account_id);
  const payload = {sub: user.account_id, username: user.username};
  return {
    access_token: generateAccessToken(JSON.stringify(payload)),
    user_id: user.account_id,
    roles: JSON.stringify(roles),
  };
}

async function compare(password: string, hashed: string) {
  const res = await bcrypt.compare(password, hashed);
  return res;
}

async function getRoles(accountId: number, schoolId?: number, classId?: number) {
  let queryStr = 'select class_id, role, school_id from roles where account_id = ?';
  const queryParams = [accountId];
  if(schoolId !== undefined) {
    queryStr = queryStr + 'and school_id = ?';
    queryParams.push(schoolId);
  }
  if(classId !== undefined) {
    queryStr = queryStr + 'and class_id = ?';
    queryParams.push(classId);
  }

  const roles = await executeQuery(
    queryStr,
    queryParams,
  );

  return roles;
}

function generateAccessToken(payload: string) {
  // todo: we should ES256
  return jwt.sign({payload}, jwtSecret, {expiresIn: '1Days', algorithm: 'HS256'});
}

function verify(token: string) {
  return jwt.verify(token, jwtSecret, {algorithms: ['HS256']});
  // return jwt.verify(token, jwtSecret, {algorithms: ['ES256']});
}

export default {signIn, init, verify}