import { accountsRouter } from "./routes/accounts.route";
import { authRouter } from "./routes/auth.route";
import classesRouter from "./routes/classes.route";
import eventsRouter from "./routes/events.route";
import { rolesRouter } from "./routes/roles.route";

const routes = [
  {
    path: '/auth',
    router: authRouter
  },
  {
    path: '/accounts',
    router: accountsRouter
  },
  {
    path: '/roles',
    router: rolesRouter
  },
  {
    path: '/classes',
    router: classesRouter
  },
  {
    path: '/events',
    router: eventsRouter
  },
];

export default routes;