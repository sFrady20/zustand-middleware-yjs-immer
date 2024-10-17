import { StateCreator, StoreMutatorIdentifier } from "zustand";
import * as Y from "yjs";
import { patchSharedType, patchStore } from "./patching";

type Yjs = <
  T extends unknown,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
  O extends unknown = undefined
>(
  doc: Y.Doc,
  name: string,
  f: StateCreator<T, Mps, Mcs>,
  transactionOrigin?: any
) => StateCreator<T, Mps, Mcs, O>;

type YjsImpl = <T extends unknown>(
  doc: Y.Doc,
  name: string,
  config: StateCreator<T, [], []>,
  transactionOrigin?: any
) => StateCreator<T, [], []>;

/**
 * This function is the middleware the sets up the Zustand store to mirror state
 * into a Yjs store for peer-to-peer synchronization.
 *
 * @example <caption>Using yjs</caption>
 * const useState = create(
 *   yjs(
 *     new Y.Doc(), // A Y.Doc to back our store with.
 *     "shared",    // A name to give the Y.Map our store is backed by.
 *     (set) =>
 *     ({
 *       "count": 1,
 *     })
 *   )
 * );
 *
 * @param doc The Yjs document to create the store in.
 * @param name The name that the store should be listed under in the doc.
 * @param config The initial state of the store we should be using.
 * @returns A Zustand state creator.
 */
const yjs: YjsImpl = <S extends unknown>(
  doc: Y.Doc,
  name: string,
  config: StateCreator<S>,
  transactionOrigin?: any
): StateCreator<S> => {
  // The root Y.Map that the store is written and read from.
  const map: Y.Map<any> = doc.getMap(name);
  // Augment the store.
  return (set, get, api) => {
    /*
     * Capture the initial state so that we can initialize the Yjs store to the
     * same values as the initial values of the Zustand store.
     */
    const initialState = config(
      /*
       * Create a new set function that defers to the original and then passes
       * the new state to patchSharedType.
       */
      (partial, replace) => {
        set(partial, replace);
        doc.transact(() => patchSharedType(map, get()), transactionOrigin);
      },
      get,
      {
        ...api,
        // Create a new setState function as we did with set.
        setState: (partial, replace) => {
          api.setState(partial, replace);
          doc.transact(
            () => patchSharedType(map, api.getState()),
            transactionOrigin
          );
        },
      }
    );

    /*
     * Whenever the Yjs store changes, we perform a set operation on the local
     * Zustand store. We avoid using the Yjs enabled set to prevent unnecessary
     * ping-pong of updates.
     */
    map.observeDeep(() => {
      patchStore(api, map.toJSON());
    });

    // Return the initial state to create or the next middleware.
    return initialState;
  };
};

export default yjs as unknown as Yjs;
