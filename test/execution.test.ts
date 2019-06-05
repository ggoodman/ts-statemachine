import { StateMachine, StateKind, StateMachineTransitions } from '../src';

describe('Executing a StateMachine', () => {
  it('will throw an exception if the machine has not yet been started', () => {
    expect(() => {
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

      m.send(Events.Start);
    }).toThrowErrorMatchingInlineSnapshot(
      `"Attempting to send an event to a state machine that has not been started"`
    );
  });

  it('will start a state machine', () => {
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

    expect(m.isDone).toBe(false);

    m.start();

    expect(m.machineState).toBe(States.Start);
    expect(m.isDone).toBe(true);
  });

  it('will return false when sending an event to a state machine that is done', () => {
    enum States {
      Start = 'Start',
    }
    enum Events {
      Start = 'Start',
      Restart = 'Restart',
    }

    const transitions: StateMachineTransitions<States, Events> = {
      [States.Start]: {
        type: StateKind.Final,
      },
    };
    const m = new StateMachine('test', States.Start, transitions);

    expect(m.isDone).toBe(false);

    m.start();

    expect(m.machineState).toBe(States.Start);
    expect(m.isDone).toBe(true);

    expect(m.send(Events.Start)).toBe(States.Start);
    expect(m.send(Events.Restart)).toBe(States.Start);
  });

  it('will throw if any events are generated during condition evaluation', () => {
    enum States {
      Started = 'Started',
      Stopped = 'Stopped',
    }
    enum Events {
      Start = 'Start',
      Stop = 'Stop',
    }

    const transitions: StateMachineTransitions<States, Events> = {
      [States.Started]: {
        on: {
          [Events.Stop]: [
            {
              condition() {
                m.send(Events.Stop);
                return true;
              },
              target: States.Stopped,
            },
          ],
        },
      },
      [States.Stopped]: {
        type: StateKind.Final,
      },
    };
    const m = new StateMachine('test', States.Started, transitions);

    expect(m.isDone).toBe(false);

    m.start();

    expect(m.machineState).toBe(States.Started);
    expect(m.isDone).toBe(false);

    expect(() => {
      m.send(Events.Stop);
    }).toThrowErrorMatchingInlineSnapshot(
      `"Events cannot be submitted while executing a condition test"`
    );
  });

  it('will only transition when conditions are met', () => {
    enum States {
      Started = 'Started',
      Stopped = 'Stopped',
    }
    enum Events {
      Start = 'Start',
      Stop = 'Stop',
    }

    let condition = false;

    const transitions: StateMachineTransitions<States, Events> = {
      [States.Started]: {
        on: {
          [Events.Stop]: [
            {
              condition() {
                return condition;
              },
              target: States.Stopped,
            },
          ],
        },
      },
      [States.Stopped]: {
        type: StateKind.Final,
      },
    };
    const m = new StateMachine('test', States.Started, transitions);

    m.start();

    expect(m.send(Events.Stop)).toBe(States.Started);

    condition = true;

    expect(m.send(Events.Stop)).toBe(States.Stopped);
  });
});
