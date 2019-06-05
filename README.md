# ts-statemachine

A typed statemachine.

## Documentation

See the [API Documentation](https://ggoodman.github.io/ts-statemachine/).

## Example

```ts
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
```

## Licence

The MIT License (MIT)

Copyright (c) Goodman Geoffrey

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.