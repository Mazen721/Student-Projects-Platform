import { USER_STATUSES } from '@spp/shared/constants';
import { authenticate } from '../auth/authenticate.js';
import { AppError } from '../errors/AppError.js';
import { can } from './can.js';
import { buildScopeFilter, resolveRoleContext } from './scopeFilter.js';
import { resolveResourceScope } from './scopeResolvers.js';

export const AUTHZ_SYMBOL = Symbol.for('spp.authz');

function runAuthenticate(req, res) {
  return new Promise((resolve, reject) => {
    authenticate(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function publicRoute() {
  const middleware = (_req, _res, next) => next();
  middleware[AUTHZ_SYMBOL] = 'public';
  return middleware;
}

export function authorize(action, resource) {
  const middleware = async (req, res, next) => {
    try {
      if (!req.user) {
        await runAuthenticate(req, res);
      }

      const roleContextHeader = req.get('x-role-context');
      const isListOrDashboard = resource === 'scope' || resource === 'self';
      const effectiveUser =
        isListOrDashboard && roleContextHeader
          ? resolveRoleContext(req.user, roleContextHeader)
          : req.user;

      const { isCollectionLevel, scope } = await resolveResourceScope(resource, req);
      if (scope === null) {
        throw AppError.notFound();
      }

      if (!can(effectiveUser, action, scope)) {
        if (
          effectiveUser.status === USER_STATUSES.PENDING &&
          can({ ...effectiveUser, status: USER_STATUSES.ACTIVE }, action, scope)
        ) {
          throw new AppError('ACCOUNT_PENDING');
        }
        throw isCollectionLevel ? AppError.forbidden() : AppError.notFound();
      }

      req.authzScope = scope;
      req.effectiveUser = effectiveUser;
      if (isListOrDashboard || resource === 'university' || resource === 'college') {
        req.scopeFilter = buildScopeFilter(effectiveUser, action);
      }

      next();
    } catch (err) {
      next(err);
    }
  };

  middleware[AUTHZ_SYMBOL] = { action, resource };
  return middleware;
}

function collectMiddlewareMarkers(stack, prefix = '', unguarded = []) {
  for (const layer of stack || []) {
    if (layer.route) {
      const fullPath = `${prefix}${layer.route.path}`;
      const hasMarker = layer.route.stack.some(
        (routeLayer) => Boolean(routeLayer.handle?.[AUTHZ_SYMBOL])
      );
      if (fullPath.startsWith('/api/v1') && !hasMarker) {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        unguarded.push(`${methods} ${fullPath}`);
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const rawMount = layer.regexp?.source || '';
      const cleaned = rawMount
        .replace(/^\^\\/, '')
        .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
        .replace(/\\\//g, '/');
      const nextPrefix = cleaned.startsWith('/') ? `${prefix}${cleaned}` : prefix;
      collectMiddlewareMarkers(layer.handle.stack, nextPrefix, unguarded);
    }
  }
  return unguarded;
}

export function assertAllRoutesGuarded(app) {
  const stack = app?._router?.stack;
  if (!stack) return;
  const unguarded = collectMiddlewareMarkers(stack);
  if (unguarded.length > 0) {
    throw new Error(`Unguarded /api/v1 routes detected: ${unguarded.join(', ')}`);
  }
}
