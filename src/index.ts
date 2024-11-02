import { patchSharedType, patchStore } from "./patching";
import { immer } from "zustand/middleware/immer";
import { Doc, Map } from "yjs";

type Options<T> = {
  doc: Doc;
  root: string;
};

export type ImmerStateCreator<T> = ReturnType<typeof immer<T>>;
export type ImmerStoreApi<T> = Parameters<Parameters<typeof immer<T>>[0]>[2];

const yjsImmer = <S extends unknown>(
  config: ImmerStateCreator<S>,
  options: Options<S>
): ImmerStateCreator<S> => {
  const { doc, root } = options;

  const map: Map<any> = doc.getMap(root);

  return (set, get, api: any) => {
    const initialState = config(
      (partial, replace) => {
        set(partial, replace as any);
        doc.transact(() => patchSharedType(map, get()));
      },
      get,
      api
    );

    map.observeDeep(() => {
      patchStore(api, map.toJSON());
    });

    return initialState;
  };
};

export default yjsImmer;
