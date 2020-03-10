import { Emitter } from 'ts-primitives';

import {
  Event,
  EventHandler,
  ExecuteEventHandler,
  InternalEvent,
  InternalEventKind,
  StateDefinition,
  StateForDef,
  StateKind,
  TransitionEventHandler,
  Transitions,
} from './types';

export class FiniteStateMachine<TEvent extends Event, TStateDef extends StateDefinition> {
  private readonly _boundSend = this.send.bind(this);
  private readonly _bufferedEvents = [] as TEvent[];
  private _currentState: StateForDef<TStateDef>;
  private _handlingEvent = false;
  private _onDidFinish = new Emitter<{ event: TEvent; state: StateForDef<TStateDef> }>();
  private _onDidReceiveEvent = new Emitter<{ event: TEvent; state: StateForDef<TStateDef> }>();
  private _onDidTransition = new Emitter<{
    event: TEvent | InternalEvent;
    state: StateForDef<TStateDef>;
    fromState: StateForDef<TStateDef>;
  }>();
  private _state = 'initial' as 'initial' | 'started' | 'finished';

  constructor(
    private readonly definition: Transitions<TEvent, TStateDef>,
    initialState: StateForDef<TStateDef>
  ) {
    this._currentState = { ...initialState };
  }

  get onDidFinish() {
    return this._onDidFinish.event;
  }

  get onDidReceiveEvent() {
    return this._onDidReceiveEvent.event;
  }

  get onDidTransition() {
    return this._onDidTransition.event;
  }

  get state() {
    return this._currentState as Readonly<StateForDef<TStateDef>>;
  }

  private handleEvent(event: TEvent) {
    const currentStateName = this._currentState.stateName as StateForDef<TStateDef>['stateName'];
    const currentStateDefinition = this.definition[currentStateName];

    if (!currentStateDefinition) {
      throw new Error(
        `Invariant violation: a state definition is missing for the current state '${currentStateName}'`
      );
    }

    const eventType = event.eventName as TEvent['eventName'];
    const eventHandlers = ((currentStateDefinition.onEvent &&
      currentStateDefinition.onEvent[eventType]) ||
      []) as EventHandler<TEvent, TStateDef, TStateDef, TEvent>[];

    this._onDidReceiveEvent.fire({
      event,
      state: this.state as StateForDef<TStateDef>,
    });

    this.runHandlers(eventHandlers, event);
  }

  private runHandlers(
    eventHandlers: EventHandler<TEvent | InternalEvent, TStateDef, TStateDef, TEvent>[],
    event: TEvent | InternalEvent
  ) {
    for (const eventHandler of eventHandlers) {
      let valid = true;

      if (typeof eventHandler.condition === 'function') {
        valid = eventHandler.condition(this._currentState, event);
      }

      if (valid) {
        const currentState = this._currentState;

        if (isExecuteHandler(eventHandler)) {
          eventHandler.execute(this._currentState, event, (event: TEvent) => {
            this.send(event);
          });

          // Note: we do not break on execute handlers and instead allow the next (if any) handler to run
        } else if (isTransitionHandler(eventHandler)) {
          const nextState = eventHandler.transition(this._currentState, event);

          if (nextState.stateName !== currentState.stateName) {
            this.transitionTo(event, nextState);
          }

          break;
        } else {
          throw new Error(`Invariant error: found an unexpected handler`);
        }
      }
    }
  }

  send(event: TEvent): void {
    if (this._state !== 'started') {
      return;
    }

    this._bufferedEvents.push(event);

    if (this._handlingEvent) {
      return;
    }

    this._handlingEvent = true;

    while (this._bufferedEvents.length) {
      const event = this._bufferedEvents.shift()!;

      this.handleEvent(event);
    }

    this._handlingEvent = false;
  }

  start() {
    if (this._state !== 'initial') {
      throw new Error(`The state machine can't be started in the '${this._state}' state`);
    }

    this._state = 'started';

    const currentStateName = this._currentState.stateName as StateForDef<TStateDef>['stateName'];
    const currentStateDefinition = this.definition[currentStateName];
    const onEnter = currentStateDefinition.onEnter;

    if (onEnter) {
      this.runHandlers(onEnter, { eventName: InternalEventKind.Start });
    }
  }

  private transitionTo<TNextState extends StateForDef<TStateDef>>(
    event: TEvent | InternalEvent,
    nextState: TNextState
  ) {
    const nextStateName = nextState.stateName as TNextState['stateName'];
    const nextStateDefinition = this.definition[nextStateName];
    const previousStateName = this.state.stateName as TNextState['stateName'];
    const previousStateDefinition = this.definition[previousStateName];
    const fromState = this._currentState;

    const onExit = previousStateDefinition.onExit;
    if (onExit) {
      this.runHandlers(onExit, event);
    }

    this._currentState = { ...nextState };

    this._onDidTransition.fire({ event, state: this._currentState, fromState });

    const onEnter = nextStateDefinition.onEnter;

    if (onEnter) {
      this.runHandlers(onEnter, event);
    }

    if (nextStateDefinition.kind === StateKind.Final) {
      this._state = 'finished';
    }
  }
}

function isExecuteHandler<
  TEvent extends Event,
  TCurrentState extends StateDefinition,
  TStateDef extends StateDefinition
>(
  handler: EventHandler<TEvent, TCurrentState, TStateDef, TEvent>
): handler is ExecuteEventHandler<TEvent, TCurrentState, TEvent> {
  return typeof (handler as any)['execute'] === 'function';
}

function isTransitionHandler<
  TEvent extends Event,
  TCurrentState extends StateDefinition,
  TStateDef extends StateDefinition
>(
  handler: EventHandler<TEvent, TCurrentState, TStateDef, TEvent>
): handler is TransitionEventHandler<TEvent, TCurrentState, TStateDef> {
  return typeof (handler as any)['transition'] === 'function';
}
