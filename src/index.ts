import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import { init } from './services/database.service';
import { DbConfig } from './types';
import authService from './services/auth.service';
import routes from './app.routes';
import { handleError } from './middleware/errors.middleware';
import { auditMiddleware } from './middleware/audit.middleware';
import dataVersionsService from './services/data-versions.service';
import auditLogService from './services/audit-log.service';

if (!process.env['DB_HOST']) throw new Error('DB_HOST is not defined');
if (!process.env['DB_NAME']) throw new Error('DB_NAME is not defined');
if (!process.env['DB_USER']) throw new Error('DB_USER is not defined');
if (!process.env['DB_PASSWORD']) throw new Error('DB_PASSWORD is not defined');
if (!process.env['DB_PORT']) throw new Error('DB_PORT is not defined');

const dbConfig: DbConfig = {
  host: process.env['DB_HOST'],
  database: process.env['DB_NAME'],
  user: process.env['DB_USER'],
  password: process.env['DB_PASSWORD'],
  port: parseInt(process.env['DB_PORT'], 10),
};

init(
  dbConfig.user,
  dbConfig.password,
  dbConfig.database,
  dbConfig.host,
  dbConfig.port,
);
authService.init(process.env['JWT_SECRET']!);

const app = express();
const port = 3000;
const isProduction = process.env['NODE_ENV'] === 'production';

app.set('trust proxy', 1);

const allowedOrigins = isProduction
  ? [
      'https://moftaked.hopto.org',
      'http://206.81.28.167:8080',
    ]
  : [
      'https://moftaked.hopto.org',
      'http://206.81.28.167:8080',
      'http://localhost',
      'http://localhost:3000',
      'http://127.0.0.1',
      'http://192.168.1.8',
    ];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (isProduction) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/^https?:\/\/[a-zA-Z0-9-]+\.lhr\.life(:\d+)?$/.test(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    } else {
      if (!origin) return callback(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(cors(corsOptions));
app.use(express.static('public'));
app.use(
  '/uploads',
  (req, res, next): void => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  },
  express.static('uploads'),
);
app.use(express.json());

app.use(auditMiddleware);

routes.forEach(route => {
  app.use(route.path, route.router);
});

app.use(handleError);

dataVersionsService.ensureTable().then(() => {
  console.log('data_versions table ensured');
}).catch((err) => {
  console.error('Failed to ensure data_versions table:', err);
});

auditLogService.ensureTable().then(() => {
  console.log('audit_logs table ensured');
}).catch((err) => {
  console.error('Failed to ensure audit_logs table:', err);
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
