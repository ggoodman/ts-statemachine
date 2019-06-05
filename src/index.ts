import {
  CancellationToken,
  CancellationTokenSource,
  Emitter,
  IDisposable,
  dispose,
} from 'ts-primitives';

export enum StateKind {
  Final = 'Final',
}

export type StateMachineTransitions<TStates extends string, TEvents extends string> = {
  [TState in TStates]: {
    on?: { [TEvent in TEvents]?: [Transition<TStates>, ...Transition<TStates>[]] };
    /**
     * A callback that will be fired as soon as the state is entered
     *
     * The state will also be considered to be entered on self-transitions
     */
    onEnter?(cancellationToken: CancellationToken): void;
    type?: StateKind;
  }
};

type Transition<TStates extends string> = {
  /**
   * The first
   */
  condition?(): boolean;
  target: TStates;
};

export enum InternalEvent {
  Initialize = 'Initialize',
}

export class StateMachine<TStates extends string, TEvents extends string> {
  private enqueueEvents = false;
  private readonly internalId: string;

  private readonly pendingCancellations: CancellationTokenSource[] = [];
  private readonly eventQueue: TEvents[] = [];
  private executingCondition = false;

  private internalState: TStates | undefined;
  private readonly transitions: StateMachineTransitions<TStates, TEvents>;

  private readonly doneEmitter = new Emitter();
  private readonly stateChangeEmitter = new Emitter<{
    event: TEvents | InternalEvent;
    state: TStates;
  }>();

  protected toDispose: IDisposable[] = [];

  constructor(
    id: string,
    private readonly initialState: TStates,
    transitions: StateMachineTransitions<TStates, TEvents>
  ) {
    this.internalId = id;

    let hasFinal = false;
    for (const stateName in transitions) {
      const transition = transitions[stateName];

      if (transition.type === StateKind.Final) {
        if (transition.on) {
          throw new TypeError(
            `A state of type === ${StateKind.Final} must not specify any .on transitions`
          );
        }

        hasFinal = true;
        break;
      }
    }

    if (!hasFinal) {
      throw new TypeError(
        `At least one of the supplied states must be marked has having type === ${StateKind.Final}`
      );
    }

    this.internalState;
    this.transitions = transitions;

    // Register disposables
    this.toDispose.push(this.doneEmitter);
    this.toDispose.push(this.stateChangeEmitter);
  }

  get id() {
    return this.internalId;
  }

  get isDone() {
    if (!this.machineState) {
      return false;
    }

    return this.transitions[this.machineState].type === StateKind.Final;
  }

  get onDone() {
    return this.doneEmitter.event;
  }

  get onStateChange() {
    return this.stateChangeEmitter.event;
  }

  get machineState() {
    return this.internalState;
  }

  private enterMachineState(state: TStates, event: TEvents | InternalEvent) {
    const targetStateTransition = this.transitions[state];
    const callbacks = [] as (() => void)[];

    if (this.internalState !== state) {
      let tokenSource = this.pendingCancellations.shift();

      while (tokenSource) {
        tokenSource.cancel();
        tokenSource.dispose();

        tokenSource = this.pendingCancellations.shift();
      }

      this.internalState = state;

      callbacks.push(() => {
        this.stateChangeEmitter.fire({
          event,
          state,
        });
      });
    }

    const onEnter = targetStateTransition.onEnter;

    if (onEnter) {
      // Wire up a cancellation token that will be sent to the
      // onEnter handler so that it can interrupt its work
      // if a subsequent transition happened
      const tokenSource = new CancellationTokenSource();

      this.pendingCancellations.push(tokenSource);

      callbacks.push(() => {
        onEnter(tokenSource.token);
      });
    }

    if (targetStateTransition.type === StateKind.Final) {
      callbacks.push(() => {
        this.doneEmitter.fire();
      });
    }

    this.enqueueEvents = true;

    while (callbacks.length) {
      const callback = callbacks.shift() as () => void;

      callback();
    }

    this.enqueueEvents = false;

    this.flushEventQueue();
  }

  private flushEventQueue() {
    if (!this.internalState) {
      throw new Error(
        'Attempting to flush the event queue on a state machine that has not been started'
      );
    }

    while (this.eventQueue.length) {
      const event = this.eventQueue.shift();

      if (!event) return;

      const transitionsForState = this.transitions[this.internalState];

      if (!transitionsForState || !transitionsForState.on) {
        continue;
      }

      const eligibleTransitions = transitionsForState.on[event] as ReadonlyArray<
        Transition<TStates>
      >;

      if (!eligibleTransitions) {
        continue;
      }

      for (const transition of eligibleTransitions) {
        const allowTransition = (() => {
          try {
            this.executingCondition = true;
            return !transition.condition || transition.condition();
          } finally {
            this.executingCondition = false;
          }
        })();

        if (allowTransition) {
          this.enterMachineState(transition.target, event);

          break;
        }
      }
    }
  }

  dispose() {
    this.toDispose = dispose(this.toDispose);
  }

  send(event: TEvents) {
    if (!this.internalState) {
      throw new Error('Attempting to send an event to a state machine that has not been started');
    }

    if (this.executingCondition) {
      throw new Error('Events cannot be submitted while executing a condition test')
    }

    this.eventQueue.push(event);

    if (this.eventQueue.length === 1 && !this.enqueueEvents) {
      // Only the event we just added is in the queue so let's schedule a flush right away
      this.flushEventQueue();
    }

    return this.internalState;
  }

  start() {
    if (this.internalState) {
      throw new Error('Attempting to start a state machine that is already started');
    }

    this.enterMachineState(this.initialState, InternalEvent.Initialize);

    return this.internalState;
  }
}
