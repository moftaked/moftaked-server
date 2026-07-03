import accountsRouter from './routes/accounts.route';
import attendanceRouter from './routes/attendance.route';
import authRouter from './routes/auth.route';
import classesRouter from './routes/classes.route';
import { districtsRouter } from './routes/districts.route';
import { equipmentRouter } from './routes/equipment.route';
import { notificationsRouter } from './routes/notifications.route';
import { reservationsRouter } from './routes/reservations.route';
import eventsRouter from './routes/events.route';
import { personsRouter } from './routes/persons.route';
import reportsRouter from './routes/reports.route';
import rolesRouter from './routes/roles.route';
import syncRouter from './routes/sync.route';

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
    path: '/districts',
    router: districtsRouter
  },
  {
    path: '/equipment',
    router: equipmentRouter,
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
    path: '/reports',
    router: reportsRouter,
  },
  {
    path: '/roles',
    router: rolesRouter,
  },
  {
    path: '/reservations',
    router: reservationsRouter,
  },
  {
    path: '/notifications',
    router: notificationsRouter,
  },
  {
    path: '/sync',
    router: syncRouter,
  },
];

export default routes;
