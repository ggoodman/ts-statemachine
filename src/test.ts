import { FSM } from './machine';

type StartEvent = {
  event: 'Start';
  securityCode: string;
};

type StopEvent = {
  event: 'Stop';
};

type Events = StartEvent | StopEvent;

interface BaseState extends FSM.State {
  securityCode: string;
}

interface StoppedState extends BaseState {
  state: 'Stopped';
}

interface StartedState extends BaseState {
  state: 'Started';
}

type States = StoppedState | StartedState;

const fsm = new FSM<Events, States>(
  {
    Stopped: {
      onEvent: {
        Start: [
          {
            condition: (state, event) => {
              return event.securityCode === state.securityCode;
            },
            transition: state => {
              return {
                ...state,
                name: 'Started',
              };
            },
          },
        ],
      },
    },
    Started: {
      onEvent: {
        Stop: [
          {
            transition: state => ({
              ...state,
              name: 'Stopped',
            }),
          },
        ],
      },
    },
  },
  {
    state: 'Stopped',
    securityCode: '123',
  }
);

export function test() {
  console.log(fsm.emit({ type: 'Start', securityCode: '321' }));
  console.log(fsm.emit({ type: 'Start', securityCode: '123' }));
}
