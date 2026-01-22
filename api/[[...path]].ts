import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError } from './_lib';

// Import all route handlers
import healthHandler from './_routes/health';

// Auth routes
import registerHandler from './_routes/auth/register';
import loginHandler from './_routes/auth/login';
import logoutHandler from './_routes/auth/logout';
import refreshHandler from './_routes/auth/refresh';
import forgotPasswordHandler from './_routes/auth/forgot-password';
import resetPasswordHandler from './_routes/auth/reset-password';

// User routes
import meHandler from './_routes/users/me';
import meAvatarHandler from './_routes/users/me/avatar';
import userSearchHandler from './_routes/users/search';
import userByIdHandler from './_routes/users/[id]';

// Lanpa routes
import lanpasHandler from './_routes/lanpas/index';
import lanpaByIdHandler from './_routes/lanpas/[id]/index';
import lanpaStatusHandler from './_routes/lanpas/[id]/status';
import lanpaGamesHandler from './_routes/lanpas/[id]/games';
import lanpaPunishmentsHandler from './_routes/lanpas/[id]/punishments';
import lanpaInviteLinkHandler from './_routes/lanpas/[id]/invite-link';
import lanpaInviteUsersHandler from './_routes/lanpas/[id]/invite-users';
import lanpaInviteByEmailHandler from './_routes/lanpas/[id]/invite-by-email';
import lanpaSuggestGameHandler from './_routes/lanpas/[id]/suggest-game';
import lanpaVoteGameHandler from './_routes/lanpas/[id]/vote-game';
import lanpaSelectGameHandler from './_routes/lanpas/[id]/select-game';
import lanpaRateHandler from './_routes/lanpas/[id]/rate';
import lanpaGameResultsHandler from './_routes/lanpas/[id]/game-results';
import lanpaMemberHandler from './_routes/lanpas/[id]/members/[memberId]';
import lanpaJoinHandler from './_routes/lanpas/join/[token]';

// Game routes
import gamesHandler from './_routes/games/index';
import gameRandomHandler from './_routes/games/random';
import gameGenresHandler from './_routes/games/genres';
import gameByIdHandler from './_routes/games/[id]/index';
import gameCoverHandler from './_routes/games/[id]/cover';

// Punishment routes
import punishmentsHandler from './_routes/punishments/index';
import punishmentByIdHandler from './_routes/punishments/[id]';
import punishmentsByUserHandler from './_routes/punishments/users/[userId]';

// Nomination routes
import nominationsHandler from './_routes/nominations/index';
import nominationByIdHandler from './_routes/nominations/[id]/index';
import nominationVoteHandler from './_routes/nominations/[id]/vote';
import nominationFinalizeHandler from './_routes/nominations/[id]/finalize';
import nominationsByLanpaHandler from './_routes/nominations/lanpa/[lanpaId]';

// Stats routes
import statsPersonalHandler from './_routes/stats/personal';
import statsGlobalHandler from './_routes/stats/global';
import statsRankingsHandler from './_routes/stats/rankings';
import statsLanpaHandler from './_routes/stats/lanpas/[id]';
import statsUserHandler from './_routes/stats/users/[id]';

// Notification routes
import notificationsHandler from './_routes/notifications/index';
import notificationsReadAllHandler from './_routes/notifications/read-all';
import notificationsPushSubscribeHandler from './_routes/notifications/subscribe-push';
import notificationsPushUnsubscribeHandler from './_routes/notifications/unsubscribe-push';
import notificationByIdHandler from './_routes/notifications/[id]/index';
import notificationReadHandler from './_routes/notifications/[id]/read';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<VercelResponse | void>;

interface Route {
  pattern: RegExp;
  handler: Handler;
  extractParams?: (match: RegExpMatchArray) => Record<string, string>;
}

const routes: Route[] = [
  // Health
  { pattern: /^\/api\/health$/, handler: healthHandler },

  // Auth
  { pattern: /^\/api\/auth\/register$/, handler: registerHandler },
  { pattern: /^\/api\/auth\/login$/, handler: loginHandler },
  { pattern: /^\/api\/auth\/logout$/, handler: logoutHandler },
  { pattern: /^\/api\/auth\/refresh$/, handler: refreshHandler },
  { pattern: /^\/api\/auth\/forgot-password$/, handler: forgotPasswordHandler },
  { pattern: /^\/api\/auth\/reset-password$/, handler: resetPasswordHandler },

  // Users
  { pattern: /^\/api\/users\/me\/avatar$/, handler: meAvatarHandler },
  { pattern: /^\/api\/users\/me$/, handler: meHandler },
  { pattern: /^\/api\/users\/search$/, handler: userSearchHandler },
  {
    pattern: /^\/api\/users\/([^/]+)$/,
    handler: userByIdHandler,
    extractParams: (m) => ({ id: m[1] })
  },

  // Lanpas - specific routes first
  {
    pattern: /^\/api\/lanpas\/join\/([^/]+)$/,
    handler: lanpaJoinHandler,
    extractParams: (m) => ({ token: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/members\/([^/]+)$/,
    handler: lanpaMemberHandler,
    extractParams: (m) => ({ id: m[1], memberId: m[2] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/status$/,
    handler: lanpaStatusHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/games$/,
    handler: lanpaGamesHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/punishments$/,
    handler: lanpaPunishmentsHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/invite-link$/,
    handler: lanpaInviteLinkHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/invite-users$/,
    handler: lanpaInviteUsersHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/invite-by-email$/,
    handler: lanpaInviteByEmailHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/suggest-game$/,
    handler: lanpaSuggestGameHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/vote-game$/,
    handler: lanpaVoteGameHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/select-game$/,
    handler: lanpaSelectGameHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/rate$/,
    handler: lanpaRateHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)\/game-results$/,
    handler: lanpaGameResultsHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/lanpas\/([^/]+)$/,
    handler: lanpaByIdHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  { pattern: /^\/api\/lanpas$/, handler: lanpasHandler },

  // Games - specific routes first
  { pattern: /^\/api\/games\/random$/, handler: gameRandomHandler },
  { pattern: /^\/api\/games\/genres$/, handler: gameGenresHandler },
  {
    pattern: /^\/api\/games\/([^/]+)\/cover$/,
    handler: gameCoverHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/games\/([^/]+)$/,
    handler: gameByIdHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  { pattern: /^\/api\/games$/, handler: gamesHandler },

  // Punishments
  {
    pattern: /^\/api\/punishments\/users\/([^/]+)$/,
    handler: punishmentsByUserHandler,
    extractParams: (m) => ({ userId: m[1] })
  },
  {
    pattern: /^\/api\/punishments\/([^/]+)$/,
    handler: punishmentByIdHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  { pattern: /^\/api\/punishments$/, handler: punishmentsHandler },

  // Nominations
  {
    pattern: /^\/api\/nominations\/lanpa\/([^/]+)$/,
    handler: nominationsByLanpaHandler,
    extractParams: (m) => ({ lanpaId: m[1] })
  },
  {
    pattern: /^\/api\/nominations\/([^/]+)\/vote$/,
    handler: nominationVoteHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/nominations\/([^/]+)\/finalize$/,
    handler: nominationFinalizeHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/nominations\/([^/]+)$/,
    handler: nominationByIdHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  { pattern: /^\/api\/nominations$/, handler: nominationsHandler },

  // Stats
  { pattern: /^\/api\/stats\/personal$/, handler: statsPersonalHandler },
  { pattern: /^\/api\/stats\/global$/, handler: statsGlobalHandler },
  { pattern: /^\/api\/stats\/rankings$/, handler: statsRankingsHandler },
  {
    pattern: /^\/api\/stats\/lanpas\/([^/]+)$/,
    handler: statsLanpaHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/stats\/users\/([^/]+)$/,
    handler: statsUserHandler,
    extractParams: (m) => ({ id: m[1] })
  },

  // Notifications
  { pattern: /^\/api\/notifications\/read-all$/, handler: notificationsReadAllHandler },
  { pattern: /^\/api\/notifications\/subscribe-push$/, handler: notificationsPushSubscribeHandler },
  { pattern: /^\/api\/notifications\/unsubscribe-push$/, handler: notificationsPushUnsubscribeHandler },
  {
    pattern: /^\/api\/notifications\/([^/]+)\/read$/,
    handler: notificationReadHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  {
    pattern: /^\/api\/notifications\/([^/]+)$/,
    handler: notificationByIdHandler,
    extractParams: (m) => ({ id: m[1] })
  },
  { pattern: /^\/api\/notifications$/, handler: notificationsHandler },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (cors(req, res)) return;

  const url = req.url || '';
  const path = url.split('?')[0];

  // Find matching route
  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) {
      // Extract params and add to query
      if (route.extractParams) {
        const params = route.extractParams(match);
        req.query = { ...req.query, ...params };
      }

      try {
        return await route.handler(req, res);
      } catch (error) {
        return handleError(error, res);
      }
    }
  }

  // No route matched
  return res.status(404).json({ error: 'Not found', path });
}
