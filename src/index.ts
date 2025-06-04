import express from 'express';
import 'dotenv/config';
import {init} from './services/database.service';
import {DbConfig} from './types';
import authService from './services/auth.service';
import { authRouter } from './routes/auth.route';

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

init(dbConfig.user, dbConfig.password, dbConfig.database, dbConfig.host, dbConfig.port);
authService.init(process.env['JWT_SECRET']!)

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

app.use('/auth', authRouter)

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
