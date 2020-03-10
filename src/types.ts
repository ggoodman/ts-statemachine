export enum InternalEventKind {
  Start = '@@Start',
}

/**
 * The most basic definition of an event is an object
 * with an `eventName` property.
 */
export interface Event {
  eventName: string;
}

/**
 * The most basic definition of a state is an object
 * with a `stateName` property.
 */
export interface State {
  stateName: string;
}

/**
 * A state definition is an object describing whether the
 * state is final or intermediate and what the shape of instances
 * of it look like.
 */
export interface StateDefinition {
  kind: StateKind;
  state: State;
}

/**
 * Utility type to produce an `StateDefinition` type for a state
 * that is not a final state (an 'intermediate' state).
 *
 * @example
 * ```ts
 * // Define an intermediate state called 'MyState' by passing
 * // the shape of the state to the `DefineIntermediateState` type.
 * type MyState = DefineIntermediateState<{
 *   stateName: 'my_state';
 *   startedAt: number;
 * }>
 * ```
 */
export type DefineIntermediateState<TState extends State> = {
  kind: StateKind.Intermediate;
  targetStates: string[];
  state: TState;
};

/**
 * A utility type to produce a `FinalState` type for final state.
 *
 * @example
 * ```ts
 * // Define a final state called 'MyState' by passing
 * // the shape of the state to the `DefineIntermediateState` type.
 * type FinalState = DefineFinalState<{
 *   stateName: 'final_state';
 *   startedAt: number;
 *   finishedAt: number;
 * }>
 * ```

 */
export type DefineFinalState<TState extends State> = {
  kind: StateKind.Final;
  state: TState;
  targetStates: [];
};

/**
 * A utility type to produce an `Event` type
 *
 * @example
 *
 * ```ts
 * type TimerEndEvent = DefineEvent<{
 *   eventName: 'timer_end';
 *   time: number;
 * }>
 * ```
 */
export type DefineEvent<TEvent extends Event> = TEvent;

export type InternalEvent = DefineEvent<{
  eventName: InternalEventKind;
}>;

export type StartEvent = DefineEvent<{
  eventName: InternalEventKind.Start;
}>;

export type StateForDef<TStateDef extends StateDefinition> = TStateDef['state'];

export enum StateKind {
  Intermediate = 'Intermediate',
  Final = 'Final',
}

/**
 * Type representing an event handler that may produce a transition
 * if an optional condition function returns truthy.
 */
export type TransitionEventHandler<
  TReceivedEvent extends Event,
  TCurrentState extends StateDefinition,
  TStateDef extends StateDefinition
> = {
  condition?(state: Readonly<StateForDef<TCurrentState>>, event: Readonly<TReceivedEvent>): boolean;
  transition(
    state: Readonly<StateForDef<TCurrentState>>,
    event: Readonly<TReceivedEvent>
  ): StateForDef<TStateDef>;
};

/**
 * Type representing an event handler that will never produce a transition
 * that will be executed unless an optional condition function is provided
 * that returns a falsy value.
 */
export type ExecuteEventHandler<
  TEvent extends Event,
  TCurrentState extends StateDefinition,
  TSendEvent extends Event
> = {
  condition?(state: Readonly<StateForDef<TCurrentState>>, event: Readonly<TEvent>): boolean;
  execute(
    state: Readonly<StateForDef<TCurrentState>>,
    event: Readonly<TEvent>,
    send: (event: TSendEvent) => void
  ): void;
};

/**
 * Type representing a generic event handler, ie: the union of a
 * `TransitionEventHandler` and a `ExecuteEventHandler`.
 */
export type EventHandler<
  TEvent extends Event,
  TCurrentState extends StateDefinition,
  TStateDef extends StateDefinition,
  TSendEvent extends Event
> =
  | TransitionEventHandler<TEvent, TCurrentState, TStateDef>
  | ExecuteEventHandler<TEvent, TCurrentState, TSendEvent>;

/**
 * Type representing the defined representation the transition handlers for
 * a given state in a `Transitions` type.
 */
export interface TransitionStateDefinition<
  TEvent extends Event,
  TStateDef extends StateDefinition,
  TStateName extends TStateDef['state']['stateName']
> extends StateDefinition {
  /**
   * Optionally define event handlers for this state.
   *
   * Keys of this object should be the `eventName` of different events and values
   * should be arrays of `EventHandlers`.
   */
  readonly onEvent?: {
    /**
     * Define an array of `EventHandler`s for the given event
     */
    [TEventType in TEvent['eventName']]?: EventHandler<
      Extract<TEvent, { eventName: TEventType }>,
      Extract<TStateDef, { state: { stateName: TStateName } }>,
      TStateDef,
      TEvent
    >[]
  };

  /**
   * A callback that will be fired as soon as the state is entered
   *
   * The state will also be considered to be entered on self-transitions
   */
  readonly onEnter?: EventHandler<
    TEvent | InternalEvent,
    Extract<TStateDef, { state: { stateName: TStateName } }>,
    TStateDef,
    TEvent
  >[];

  /**
   * A callback that will be fired as soon as the state is exited
   *
   * The state will also be considered to be exited on self-transitions
   */
  readonly onExit?: EventHandler<
    TEvent,
    Extract<TStateDef, { state: { stateName: TStateName } }>,
    TStateDef,
    TEvent
  >[];
}

/**
 * Type representing all states and their transition definitions
 */
export type Transitions<TEvent extends Event, TStateDef extends StateDefinition> = {
  readonly [TStateName in TStateDef['state']['stateName']]: TransitionStateDefinition<
    TEvent,
    TStateDef,
    TStateName
  >
};
