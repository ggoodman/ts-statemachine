import { StateMachineTransitions, StateMachine, StateKind } from '../src';
import { AssertionError } from 'assert';

declare function checkIgnitionKey(): boolean;

// Define possible events
enum Events {
  Start = 'Start',
  Stop = 'Stop',
}

// Define possible states
enum States {
  Idle = 'Idle',
  Started = 'Started',
  Alarming = 'Alarming',
  Stopped = 'Stopped',
}

// Define the set of valid transitions
const transitions: StateMachineTransitions<States, Events> = {
  [States.Idle]: {
    on: {
      // When in the Idle state, the Start Event will transition to the Started state if
      // the ignition check succeeds, otherwise the next action will run and the state
      // machine will instead transition to the Alarming state.
      [Events.Start]: [
        {
          // Only transition to the started state if the optional condition function
          // returns true
          condition() {
            return checkIgnitionKey();
          },
          target: States.Started,
        },
        {
          target: States.Alarming,
        },
      ],
    },
  },
  [States.Started]: {
    on: {
      [Events.Stop]: [{ target: States.Stopped }],
    },
  },
  [States.Alarming]: {
    type: StateKind.Final,
  },
  [States.Stopped]: {
    type: StateKind.Final,
  },
};

// Represents a hypothetical machine that can be started but only if the ignition key
// check succeeds. If this check fails the machine will sound an alarm. From the started
// state, the machine can then be stopped.
const machine = new StateMachine('test', States.Idle, transitions);

machine.send(Events.Start); // === States.Started
machine.send(Events.Start); // === States.Started
machine.send(Events.Stop); // === States.Stopped
machine.isDone; // === true