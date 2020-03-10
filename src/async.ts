import { defineMachine } from './builder';
import { DefineEvent, DefineIntermediateState, DefineFinalState } from './types';

type PromiseReject = DefineEvent<{
  eventName: '@@promiseReject';
  err: unknown;
}>;

type PromiseResolve<T> = DefineEvent<{
  eventName: '@@promiseResolve';
  value: T;
}>;

type PromisePending<T> = DefineIntermediateState<{
  stateName: '@@promisePending';
  promise: Promise<T>;
}>;

type PromiseResolved<T> = DefineFinalState<{
  stateName: '@@promiseResolved';
  value: T;
}>;

type PromiseRejected = DefineFinalState<{
  stateName: '@@promiseRejected';
  err: unknown;
}>;

export function fromPromise<T>(promise: Promise<T>) {
  const promiseMachine = defineMachine<
    PromiseReject | PromiseResolve<T>,
    PromisePending<T> | PromiseResolved<T> | PromiseRejected
  >().state('@@promisePending', state =>
    state
      .onEnterExecute((state, _event, send) => {
        state.promise.then(
          value => send({ eventName: '@@promiseResolve', value }),
          err => send({ eventName: '@@promiseReject', err })
        );
      })
      .onEventTransition(
        '@@promiseResolve',
        (_state, event) => ({
          stateName: '@@promiseResolved',
          value: event.value,
        }),
        {
          targetStates: ['@@promiseResolved'],
        }
      )
      .onEventTransition(
        '@@promiseReject',
        (_state, event) => ({
          stateName: '@@promiseRejected',
          err: event.err,
        }),
        {
          targetStates: ['@@promiseRejected'],
        }
      )
  );

  return promiseMachine.instantiate({
    stateName: '@@promisePending',
    promise,
  });
}
