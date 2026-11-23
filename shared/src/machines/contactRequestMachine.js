import { CONTACT_REQUEST_STATES, CONTACT_REQUEST_STATE_VALUES } from '../constants/index.js';
import { defineMachine } from './fsm.js';

export const contactRequestMachine = defineMachine({
  initial: CONTACT_REQUEST_STATES.PENDING,
  states: CONTACT_REQUEST_STATE_VALUES,
  transitions: {
    ACCEPT: {
      from: [CONTACT_REQUEST_STATES.PENDING],
      to: CONTACT_REQUEST_STATES.ACCEPTED,
      roles: ['leader'],
    },
    DECLINE: {
      from: [CONTACT_REQUEST_STATES.PENDING],
      to: CONTACT_REQUEST_STATES.DECLINED,
      roles: ['leader'],
    },
    WITHDRAW: {
      from: [CONTACT_REQUEST_STATES.PENDING],
      to: CONTACT_REQUEST_STATES.WITHDRAWN,
      roles: ['investor'],
    },
  },
});
