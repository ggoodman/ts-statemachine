import { StateMachine, StateKind, StateMachineTransitions } from '../src';

describe('Contructing a StateMachine', () => {
  it('will throw a TypeError when no final states are provided', () => {
    expect(() => {
      enum States {
        Start = 'Start',
      }
      enum Events {
        Start = 'Start',
      }

      const transitions: StateMachineTransitions<States, Events> = {
        [States.Start]: {},
      };

      return new StateMachine('test', States.Start, transitions);
    }).toThrowErrorMatchingInlineSnapshot(
      `"At least one of the supplied states must be marked has having type === Final"`
    );
  });
  it('will throw a TypeError if a final state supplies transitions', () => {
    expect(() => {
      enum States {
        Start = 'Start',
      }
      enum Events {
        Start = 'Start',
        Restart = 'Restart',
      }

      const transitions: StateMachineTransitions<States, Events> = {
        [States.Start]: {
          on: {
            [Events.Restart]: [{ target: States.Start }],
          },
        },
      };

      return new StateMachine('test', States.Start, transitions);
    }).toThrowErrorMatchingInlineSnapshot(
      `"At least one of the supplied states must be marked has having type === Final"`
    );
  });

  it('will accept a transitions definition with a final state', () => {
    enum States {
      Start = 'Start',
    }
    enum Events {
      Start = 'Start',
    }

    const transitions: StateMachineTransitions<States, Events> = {
      [States.Start]: {
        type: StateKind.Final,
      },
    };
    const m = new StateMachine('test', States.Start, transitions);

    expect(m instanceof StateMachine).toBe(true);
  });
});
