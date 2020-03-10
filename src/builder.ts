import { FiniteStateMachine } from './machine';
import {
  Event,
  EventHandler,
  ExecuteEventHandler,
  StateDefinition,
  StateKind,
  TransitionEventHandler,
  Transitions,
  TransitionStateDefinition,
} from './types';

class StateBuilder<
  TEvent extends Event,
  TStateDef extends StateDefinition,
  TStateName extends TStateDef['state']['stateName']
> implements TransitionStateDefinition<TEvent, TStateDef, TStateName> {
  state!: TStateDef['state'];

  private _onEnter = [] as (EventHandler<
    TEvent,
    Extract<TStateDef, { state: { stateName: TStateName } }>,
    TStateDef,
    TEvent
  > & { targetStates?: TStateDef['state']['stateName'][] })[];
  private _onExit = [] as EventHandler<
    TEvent,
    Extract<TStateDef, { state: { stateName: TStateName } }>,
    TStateDef,
    TEvent
  >[];

  private _onEvent = {} as Record<
    TEvent['eventName'],
    | (EventHandler<
        TEvent,
        Extract<TStateDef, { state: { stateName: TStateName } }>,
        TStateDef,
        TEvent
      > & { targetStates?: TStateDef['state']['stateName'][] })[]
    | undefined
  >;

  constructor(private readonly _stateName: TStateName, private readonly _kind: StateKind) {}

  /** @internal */
  get kind() {
    return this._kind;
  }

  /** @internal */
  get onEnter() {
    return this._onEnter;
  }

  /** @internal */
  get onExit() {
    return this._onExit;
  }

  /** @internal */
  get onEvent() {
    return this._onEvent;
  }

  /** @internal */
  get stateName() {
    return this._stateName;
  }

  onEnterExecute<
    THandler extends ExecuteEventHandler<
      TEvent,
      Extract<TStateDef, { state: { stateName: TStateName } }>,
      TEvent
    >
  >(execute: THandler['execute'], condition?: THandler['condition']): this {
    this._onEnter.push({ condition, execute });

    return this;
  }

  onEnterTransition<
    THandler extends TransitionEventHandler<
      TEvent,
      Extract<TStateDef, { state: { stateName: TStateName } }>,
      Extract<TStateDef, { state: { stateName: TTargetState } }>
    >,
    TTargetState extends TStateDef['state']['stateName'] = TStateDef['state']['stateName']
  >(
    transition: THandler['transition'],
    options: { condition?: THandler['condition']; targetStates?: TTargetState[] } = {}
  ): this {
    this._onEnter.push({
      condition: options.condition,
      targetStates: options.targetStates,
      transition,
    });

    return this;
  }

  onExitExecute<
    THandler extends ExecuteEventHandler<
      TEvent,
      Extract<TStateDef, { state: { stateName: TStateName } }>,
      TEvent
    >
  >(execute: THandler['execute'], condition?: THandler['condition']): this {
    this._onExit.push({ condition, execute });

    return this;
  }

  onEventExecute<
    THandler extends ExecuteEventHandler<
      Extract<TEvent, { eventName: TEventName }>,
      Extract<TStateDef, { state: { stateName: TStateName } }>,
      TEvent
    >,
    TEventName extends TEvent['eventName']
  >(eventName: TEventName, execute: THandler['execute'], condition?: THandler['condition']): this {
    let onEvent = this._onEvent[eventName];

    if (!onEvent) {
      onEvent = [];
      this._onEvent[eventName] = onEvent;
    }

    onEvent.push({ condition, execute });

    return this;
  }

  onEventTransition<
    THandler extends TransitionEventHandler<
      Extract<TEvent, { eventName: TEventName }>,
      Extract<TStateDef, { state: { stateName: TStateName } }>,
      Extract<TStateDef, { state: { stateName: TTargetState } }>
    >,
    TEventName extends TEvent['eventName'],
    TTargetState extends TStateDef['state']['stateName']
  >(
    eventName: TEventName,
    transition: THandler['transition'],
    options: { condition?: THandler['condition']; targetStates?: TTargetState[] } = {}
  ): this {
    let onEvent = this._onEvent[eventName];

    if (!onEvent) {
      onEvent = [];
      this._onEvent[eventName] = onEvent;
    }

    onEvent.push({ condition: options.condition, targetStates: options.targetStates, transition });

    return this;
  }

  toJSON() {
    return {
      kind: this.kind,
      onEnter: this.onEnter,
      onEvent: this.onEvent,
      onExit: this.onExit,
    };
  }
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

class TransitionsBuilder<TEvent extends Event, TStateDef extends StateDefinition> {
  private _transitions = {} as Mutable<Transitions<TEvent, TStateDef>>;

  finalState<
    TStateName extends Extract<TStateDef, { kind: StateKind.Final }>['state']['stateName']
  >(
    stateName: TStateName,
    buildFn?: (builder: StateBuilder<TEvent, TStateDef, TStateName>) => void
  ) {
    let state = this._transitions[stateName] as StateBuilder<TEvent, TStateDef, TStateName>;

    if (!state) {
      state = new StateBuilder<TEvent, TStateDef, TStateName>(stateName, StateKind.Final);
      this._transitions[stateName] = state;
    } else {
      if (state.kind !== StateKind.Final) {
        throw new Error(
          `The state '${stateName}' was already defined with type '${
            state.kind
          }' which is in conflict with the requested type '${StateKind.Final}'`
        );
      }
    }

    if (typeof buildFn === 'function') {
      buildFn(state);
    }

    return this;
  }

  state<
    TStateName extends Extract<TStateDef, { kind: StateKind.Intermediate }>['state']['stateName']
  >(
    stateName: TStateName,
    buildFn?: (builder: StateBuilder<TEvent, TStateDef, TStateName>) => void
  ): this {
    let state = this._transitions[stateName] as StateBuilder<TEvent, TStateDef, TStateName>;

    if (!state) {
      state = new StateBuilder<TEvent, TStateDef, TStateName>(stateName, StateKind.Intermediate);
      this._transitions[stateName] = state;
    } else {
      if (state.kind !== StateKind.Intermediate) {
        throw new Error(
          `The state '${stateName}' was already defined with type '${
            state.kind
          }' which is in conflict with the requested type '${StateKind.Intermediate}'`
        );
      }
    }

    if (typeof buildFn === 'function') {
      buildFn(state);
    }

    return this;
  }

  instantiate<TInitialState extends TStateDef['state']>(initialState: TInitialState) {
    const transitions = this.toJSON();
    const fsm = new FiniteStateMachine(transitions, initialState);

    return fsm;
  }

  toJSON() {
    return Object.freeze(Object.assign(Object.create(null), this._transitions));
  }
}

/**
 * Define a state machine
 *
 * @template TEvent - The type of all accepted events. These events should be defined using the `DefineEvent` type
 * @template TStateDef - The type of all defined states. These states should be defined using the `DefineIntermediateState` and `DefineFinalState` types
 *
 * @example
 *
 * ```ts
 * // Define a stop light that will cycle through 'red', 'green' and 'orange' states
 * // at every 'tick' event.
 * type TickEvent = DefineEvent<{ eventName: 'tick' }>;
 * type RedState = DefineIntermediateState<{ stateName: 'red' }>;
 * type GreenState = DefineIntermediateState<{ stateName: 'green' }>;
 * type OrangeState = DefineIntermediateState<{ stateName: 'orange' }>;
 *
 * const myMachine = defineMachine<TickEvent, RedState | GreenState | OrangeState>()
 *   .state('red', state => {
 *     state.onEventTransition('tick', () => ({ stateName: 'green' }), { targetStates: ['green'] })
 *   })
 *   .state('green', state => {
 *     state.onEventTransition('tick', () => ({ stateName: 'orange' }), { targetStates: ['orange'] })
 *   })
 *   .state('orange', state => {
 *     state.onEventTransition('tick', () => ({ stateName: 'green' }), { targetStates: ['green'] })
 *   })
 * ```
 */
export function defineMachine<TEvent extends Event, TStateDef extends StateDefinition>() {
  return new TransitionsBuilder<TEvent, TStateDef>();
}
