import * as Y from "yjs";
import { diff, } from "json-diff";
import { arrayToYArray, objectToYMap, } from "./mapping";
import { State, StoreApi, } from "zustand/vanilla";

/**
 * A record that documents a change to an entry in an array or object.
 */
export type Change = [
  "add" | "update" | "delete" | "pending" | "none",
  string | number,
  any
];

/**
 * Computes a diff between a and b and creates a list of changes that transform
 * a into b. This list of changes are only for the top level of a. Nested
 * changes are denoted by a 'pending' entry, indicating that a change resolver
 * will need to recurse in order to fully transform a into b.
 *
 * @param a The 'old' object to compare to the 'new' object.
 * @param b The 'new' object to compare to the 'old' object.
 * @returns A list of Changes that inform what is different between a and b.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getChangeList = (a: any, b: any): Change[] =>
{
  const delta = diff(a, b);
  const changes: Change[] = [];

  if (delta instanceof Array)
  {
    let offset = 0;

    delta.forEach(([ type, value ], index) =>
    {
      switch (type)
      {
      case "+":
        if (0 < changes.length && changes[changes.length-1][0] === "delete")
          offset--;

        changes.push([ "add", index + offset, value ]);

        break;

      case "-":
        changes.push([ "delete", index + offset, undefined ]);
        break;

      case "~":
        changes.push([ "pending", index + offset, undefined ]);
        break;

      case " ":
      default:
        changes.push([ "none", index + offset, value ]);
        break;
      }
    });
  }
  else if (delta instanceof Object)
  {
    Object.entries(a).forEach(([ property, value ]) =>
    {
      const deltaDeletesFromA = Object.keys(delta).some((p) =>
        p === `${property}__deleted`);

      const deltaUpdatesA = Object.keys(delta).some((p) =>
        p === property);

      if (!deltaDeletesFromA && !deltaUpdatesA)
        delta[property] = value;
    });

    (Object.entries({ ...delta, }) as [ string, any ])
      .forEach(([ property, value ]) =>
      {
        if (property.match(/__added$/))
          changes.push([ "add", property.replace(/__added$/, ""), value ]);

        else if (property.match(/__deleted$/))
          changes.push([ "delete", property.replace(/__deleted$/, ""), undefined ]);

        else if (value.__old !== undefined && value.__new !== undefined)
          changes.push([ "update", property, value.__new ]);

        else if (value instanceof Object)
          changes.push([ "pending", property, undefined ]);

        else
          changes.push([ "none", property, value ]);
      });
  }

  return changes;
};

/**
 * Diffs sharedType and newState to create a list of changes for transforming
 * the contents of sharedType into that of newState. For every nested, 'pending'
 * change detected, this function recurses, as a nested object or array is
 * represented as a Y.Map or Y.Array.
 *
 * @param sharedType The Yjs shared type to patch.
 * @param newState The new state to patch the shared type into.
 */
export const patchSharedType = (
  sharedType: Y.Map<any> | Y.Array<any>,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  newState: any
): void =>
{
  const changes = getChangeList(sharedType.toJSON(), newState);

  changes.forEach(([ type, property, value ]) =>
  {
    switch (type)
    {
    case "add":
    case "update":
      if ((value instanceof Function) === false)
      {
        if (sharedType instanceof Y.Map)
        {
          if (value instanceof Array)
            sharedType.set(property as string, arrayToYArray(value));

          else if (value instanceof Object)
            sharedType.set(property as string, objectToYMap(value));

          else
            sharedType.set(property as string, value);
        }

        else if (sharedType instanceof Y.Array)
        {
          const index = property as number;

          const left = sharedType.slice(0, index);
          const right = sharedType.slice(index+1);

          sharedType.delete(0, sharedType.length);

          if (value instanceof Array)
          {
            sharedType.insert(0, [
              ...left,
              arrayToYArray(value),
              ...right
            ]);
          }
          else if (value instanceof Object)
          {
            sharedType.insert(0, [
              ...left,
              objectToYMap(value),
              ...right
            ]);
          }
          else
            sharedType.insert(0, [ ...left, value, ...right ]);
        }
      }
      break;

    case "delete":
      if (sharedType instanceof Y.Map)
        sharedType.delete(property as string);

      else if (sharedType instanceof Y.Array)
        sharedType.delete(property as number, 1);

      break;

    case "pending":
      if (sharedType instanceof Y.Map)
      {
        patchSharedType(
          sharedType.get(property as string),
          newState[property as string]
        );
      }
      else if (sharedType instanceof Y.Array)
      {
        patchSharedType(
          sharedType.get(property as number),
          newState[property as number]
        );
      }
      break;

    default:
      break;
    }
  });
};

/**
 * Diffs the current state stored in the Zustand store and the given newState.
 * The current Zustand state is patched into the given new state recursively.
 *
 * @param store The Zustand API that manages the store we want to patch.
 * @param newState The new state that the Zustand store should be patched to.
 */
export const patchStore = <S extends State>(
  store: StoreApi<S>,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  newState: any
): void =>
{
  /**
   * Patches oldState to be identical to newState. This function recurses when
   * an array or object is encountered. If oldState and newState are already
   * identical (indicated by an empty diff), then oldState is returned.
   *
   * @param oldState The state we want to patch.
   * @param newState The state we want oldState to match after patching.
   *
   * @returns The patched oldState, identical to newState.
   */
  const patch = (oldState: any, newState: any): any =>
  {
    const changes = getChangeList(oldState, newState);

    if (changes.length === 0)
      return oldState;

    else
    {
      const p: any = changes.reduce(
        (state, [ type, property, value ]) =>
        {
          switch (type)
          {
          case "add":
          case "update":
          case "none":
          {
            return {
              ...state,
              [property]: value,
            };
          }

          case "pending":
          {
            return {
              ...state,
              [property]: patch(
                oldState[property as string],
                newState[property as string]
              ),
            };
          }

          case "delete":
          default:
            return state;
          }
        },
        {}
      );

      return {
        ...Object.entries(oldState).reduce(
          (o, [ property, value ]) =>
            (
              value instanceof Function
                ? { ...o, [property]: value, }
                : o
            ),
          {}
        ),
        ...p,
      };
    }
  };

  store.setState(
    patch(store.getState(), newState),
    true // Replace with the patched state.
  );
};