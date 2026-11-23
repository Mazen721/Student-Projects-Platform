export function defineMachine({ initial, states, transitions }) {
  function evaluate(state, event, ctx = {}) {
    const def = transitions[event];
    if (!def || !states.includes(state) || !def.from.includes(state)) {
      return { allowed: false, code: 'INVALID_TRANSITION' };
    }
    if (def.roles && def.roles.length > 0) {
      const callerRoles = Array.isArray(ctx.roles) ? ctx.roles : [];
      const hasRole = def.roles.some((role) => callerRoles.includes(role));
      if (!hasRole) {
        return { allowed: false, code: 'FORBIDDEN' };
      }
    }
    if (typeof def.guard === 'function') {
      const guardCode = def.guard(ctx, state, event);
      if (guardCode) {
        return { allowed: false, code: guardCode };
      }
    }
    return { allowed: true, from: state, to: def.to, event };
  }

  function can(state, event, ctx = {}) {
    return evaluate(state, event, ctx).allowed;
  }

  function next(state, event, ctx = {}) {
    const outcome = evaluate(state, event, ctx);
    if (!outcome.allowed) {
      const error = new Error(outcome.code);
      error.code = outcome.code;
      throw error;
    }
    return { from: outcome.from, to: outcome.to, event: outcome.event };
  }

  function allowedEvents(state, ctx = {}) {
    return Object.keys(transitions).filter((event) => can(state, event, ctx));
  }

  return Object.freeze({ initial, states, transitions, evaluate, can, next, allowedEvents });
}
