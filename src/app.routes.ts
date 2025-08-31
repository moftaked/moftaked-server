import accountsRouter from './routes/accounts.route';
import attendanceRouter from './routes/attendance.route';
import authRouter from './routes/auth.route';
import classesRouter from './routes/classes.route';
import eventsRouter from './routes/events.route';
import { personsRouter } from './routes/persons.route';
import rolesRouter from './routes/roles.route';

const routes = [
  {
    path: '/accounts',
    router: accountsRouter,
  },
  {
    path: '/attendance',
    router: attendanceRouter
  },
  {
    path: '/auth',
    router: authRouter,
  },
  {
    path: '/classes',
    router: classesRouter,
  },
  {
    path: '/events',
    router: eventsRouter,
  },
  {
    path: '/persons',
    router: personsRouter
  },
  {
    path: '/roles',
    router: rolesRouter,
  },
];

export default routes;
