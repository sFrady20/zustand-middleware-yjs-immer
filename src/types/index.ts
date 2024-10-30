import { Draft } from "immer";

/**
 * Describes the change that needs to be made.
 */
export enum ChangeType { // eslint-disable-line @typescript-eslint/indent
  /** No change. */
  NONE = "none",
  /** A value was inserted. */
  INSERT = "insert",
  /** A value was replaced. */
  UPDATE = "update",
  /** A value was deleted. */
  DELETE = "delete",
  /** The value requires a recursive diff to identify further changes. */
  PENDING = "pending",
}

/**
 * A record that documents a change to an entry in an array or object.
 */
export type Change = [ChangeType, string | number, any];

/**
 * pulled from zustand immer middleware (no export)
 */
type Write<T, U> = Omit<T, keyof U> & U;
type SkipTwo<T> = T extends {
  length: 0;
}
  ? []
  : T extends {
      length: 1;
    }
  ? []
  : T extends {
      length: 0 | 1;
    }
  ? []
  : T extends [unknown, unknown, ...infer A]
  ? A
  : T extends [unknown, unknown?, ...infer A]
  ? A
  : T extends [unknown?, unknown?, ...infer A]
  ? A
  : never;
export type WithImmer<S> = Write<S, StoreImmer<S>>;
type StoreImmer<S> = S extends {
  getState: () => infer T;
  setState: infer SetState;
}
  ? SetState extends (...a: infer A) => infer Sr
    ? {
        setState(
          nextStateOrUpdater: T | Partial<T> | ((state: Draft<T>) => void),
          shouldReplace?: boolean | undefined,
          ...a: SkipTwo<A>
        ): Sr;
      }
    : never
  : never;
