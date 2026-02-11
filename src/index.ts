import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { init } from './services/database.service';
import { DbConfig } from './types';
import authService from './services/auth.service';
import routes from './app.routes';
import { handleError } from './middleware/errors.middleware';
import dataVersionsService from './services/data-versions.service';

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

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'https://moftaked.hopto.org',
      'http://127.0.0.1',
    ];
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true);
    // Allow any localhost/127.0.0.1 origin (any port) for development
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());

routes.forEach(route => {
  app.use(route.path, route.router);
});

app.use(handleError);

dataVersionsService.ensureTable().then(() => {
  console.log('data_versions table ensured');
}).catch((err) => {
  console.error('Failed to ensure data_versions table:', err);
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
