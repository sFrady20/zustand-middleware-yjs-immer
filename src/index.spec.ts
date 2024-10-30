import { spawn, ChildProcess } from "child_process";
import path from "path";
import { act, renderHook } from "@testing-library/react-hooks";
import { createStore as createVanilla } from "zustand/vanilla";
import { create } from "zustand";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import yjsImmer from ".";

describe("Yjs middleware", () => {
  it("Creates a useState function.", () => {
    type Store = {
      count: number;
      increment: () => void;
    };

    const { getState } = createVanilla<Store, [["zustand/immer", unknown]]>(
      yjsImmer(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }),
        { doc: new Y.Doc(), name: "hello" }
      )
    );

    expect(getState().count).toBe(0);

    getState().increment();

    expect(getState().count).toBe(1);
  });

  it("Receives changes from peers.", () => {
    type Store = {
      count: number;
      increment: () => void;
    };

    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    doc1.on("update", (update: any) => {
      Y.applyUpdate(doc2, update);
    });
    doc2.on("update", (update: any) => {
      Y.applyUpdate(doc1, update);
    });

    const storeName = "store";

    const { getState: getStateA } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }),
        { doc: doc1, name: storeName }
      )
    );

    const { getState: getStateB } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }),
        { doc: doc2, name: storeName }
      )
    );

    expect(getStateA().count).toBe(0);
    expect(getStateB().count).toBe(0);

    getStateA().increment();

    expect(getStateA().count).toBe(1);
    expect(getStateB().count).toBe(1);
  });

  it("Performs nested updates.", () => {
    type Store = {
      person: {
        age: number;
      };
      getOlder: () => void;
    };

    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    doc1.on("update", (update: any) => {
      Y.applyUpdate(doc2, update);
    });
    doc2.on("update", (update: any) => {
      Y.applyUpdate(doc1, update);
    });

    const storeName = "store";

    const { getState: getStateA } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          person: {
            age: 0,
            name: "Joe",
          },
          getOlder: () =>
            set((state) => ({
              person: { ...state.person, age: state.person.age + 1 },
            })),
        }),
        { doc: doc1, name: storeName }
      )
    );

    const { getState: getStateB } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          person: {
            age: 0,
            name: "Joe",
          },
          getOlder: () =>
            set((state) => ({
              person: { ...state.person, age: state.person.age + 1 },
            })),
        }),
        { doc: doc2, name: storeName }
      )
    );

    expect(getStateA().person.age).toBe(0);
    expect(getStateB().person.age).toBe(0);

    getStateA().getOlder();

    expect(getStateA().person.age).toBe(1);
    expect(getStateB().person.age).toBe(1);
  });

  it("Performs deep nested updates.", () => {
    type Store = {
      owner: {
        person: {
          age: number;
          name: string;
        };
      };
      getOlder: () => void;
    };

    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    doc1.on("update", (update: any) => {
      Y.applyUpdate(doc2, update);
    });
    doc2.on("update", (update: any) => {
      Y.applyUpdate(doc1, update);
    });

    const storeName = "store";

    const { getState: getStateA } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          owner: {
            person: {
              age: 0,
              name: "Joe",
            },
          },
          getOlder: () =>
            set((state) => ({
              owner: {
                ...state.owner,
                person: {
                  ...state.owner.person,
                  age: state.owner.person.age + 1,
                },
              },
            })),
        }),
        {
          doc: doc1,
          name: storeName,
        }
      )
    );
    const { getState: getStateB } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          owner: {
            person: {
              age: 0,
              name: "Joe",
            },
          },
          getOlder: () =>
            set((state) => ({
              owner: {
                ...state.owner,
                person: {
                  ...state.owner.person,
                  age: state.owner.person.age + 1,
                },
              },
            })),
        }),
        {
          doc: doc1,
          name: storeName,
        }
      )
    );

    expect(getStateA().owner.person.age).toBe(0);
    expect(getStateB().owner.person.age).toBe(0);

    getStateA().getOlder();

    expect(getStateA().owner.person.age).toBe(1);
    expect(getStateB().owner.person.age).toBe(1);
  });

  it("Updates arrays in objects.", () => {
    type Store = {
      room: {
        users: string[];
      };
      join: (user: string) => void;
    };

    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    doc1.on("update", (update: any) => {
      Y.applyUpdate(doc2, update);
    });
    doc2.on("update", (update: any) => {
      Y.applyUpdate(doc1, update);
    });

    const storeName = "store";

    const { getState: getStateA } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          room: {
            users: ["amy", "sam", "harold"],
          },
          join: (user) =>
            set((state) => ({
              room: {
                ...state.room,
                users: [...state.room.users, user],
              },
            })),
        }),
        {
          doc: doc1,
          name: storeName,
        }
      )
    );

    const { getState: getStateB } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          room: {
            users: ["amy", "sam", "harold"],
          },
          join: (user) =>
            set((state) => ({
              room: {
                ...state.room,
                users: [...state.room.users, user],
              },
            })),
        }),
        {
          doc: doc1,
          name: storeName,
        }
      )
    );

    expect(getStateA().room.users).toEqual(["amy", "sam", "harold"]);
    expect(getStateB().room.users).toEqual(["amy", "sam", "harold"]);

    getStateA().join("bob");

    expect(getStateA().room.users).toEqual(["amy", "sam", "harold", "bob"]);
    expect(getStateB().room.users).toEqual(["amy", "sam", "harold", "bob"]);
  });

  it("Updates objects in arrays.", () => {
    type Store = {
      users: { name: string; status: "online" | "offline" }[];
      setStatus: (userName: string, status: "online" | "offline") => void;
    };

    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    doc1.on("update", (update: any) => {
      Y.applyUpdate(doc2, update);
    });
    doc2.on("update", (update: any) => {
      Y.applyUpdate(doc1, update);
    });

    const storeName = "store";

    const { getState: getStateA } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          users: [
            {
              name: "alice",
              status: "offline",
            },
            {
              name: "bob",
              status: "offline",
            },
          ],
          setStatus: (userName, status) => {
            set((state) => ({
              ...state,
              users: [
                ...state.users.filter(({ name }) => name !== userName),
                {
                  name: userName,
                  status: status,
                },
              ],
            }));
          },
        }),
        {
          doc: doc1,
          name: storeName,
        }
      )
    );

    const { getState: getStateB } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          users: [
            {
              name: "alice",
              status: "offline",
            },
            {
              name: "bob",
              status: "offline",
            },
          ],
          setStatus: (userName, status) => {
            set((state) => ({
              ...state,
              users: [
                ...state.users.filter(({ name }) => name !== userName),
                {
                  name: userName,
                  status: status,
                },
              ],
            }));
          },
        }),
        {
          doc: doc1,
          name: storeName,
        }
      )
    );

    expect(getStateA().users).toEqual([
      { name: "alice", status: "offline" },
      { name: "bob", status: "offline" },
    ]);
    expect(getStateB().users).toEqual([
      { name: "alice", status: "offline" },
      { name: "bob", status: "offline" },
    ]);

    getStateA().setStatus("bob", "online");

    expect(getStateA().users).toEqual([
      { name: "alice", status: "offline" },
      { name: "bob", status: "online" },
    ]);
    expect(getStateA().users).toEqual([
      { name: "alice", status: "offline" },
      { name: "bob", status: "online" },
    ]);
  });

  it("passes the optional string transactionOrigin to document.transact calls", () => {
    const ORIGIN_NAME = "new-transaction-origin";
    type Store = {
      count: number;
      increment: () => void;
    };

    const doc1 = new Y.Doc();

    let receivedOrigin: any;

    doc1.on("update", (update: any, origin: any) => {
      receivedOrigin = origin;
    });

    const storeName = "store";

    const { getState: getStateA } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }),
        {
          doc: doc1,
          name: storeName,
          transactionOrigin: ORIGIN_NAME,
        }
      )
    );

    expect(getStateA().count).toBe(0);

    getStateA().increment();

    expect(getStateA().count).toBe(1);
    expect(receivedOrigin).toBe(ORIGIN_NAME);
  });

  it("passes the optional object to document.transact calls", () => {
    const ORIGIN = {
      name: "Person 1",
    };
    type Store = {
      count: number;
      increment: () => void;
    };

    const doc1 = new Y.Doc();

    let receivedOrigin: any;

    doc1.on("update", (update: any, origin: any) => {
      receivedOrigin = origin;
    });

    const storeName = "store";

    const { getState: getStateA } = createVanilla<
      Store,
      [["zustand/immer", unknown]]
    >(
      yjsImmer(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }),
        {
          doc: doc1,
          name: storeName,
          transactionOrigin: ORIGIN,
        }
      )
    );

    expect(getStateA().count).toBe(0);

    getStateA().increment();

    expect(getStateA().count).toBe(1);
    expect(receivedOrigin.name).toBe(ORIGIN.name);
  });

  describe("When adding consecutive entries into arrays", () => {
    it("Does not throw when inserting multiple scalars into arrays.", () => {
      type Store = {
        numbers: number[];
        addNumber: (n: number) => void;
      };

      const doc = new Y.Doc();

      const api = createVanilla<Store, [["zustand/immer", unknown]]>(
        yjsImmer(
          (set) => ({
            numbers: [],
            addNumber: (n) =>
              set((state) => ({
                numbers: [...state.numbers, n],
              })),
          }),
          {
            doc: doc,
            name: "hello",
          }
        )
      );

      expect(api.getState().numbers).toEqual([]);

      expect(() => {
        api.getState().addNumber(0);
        api.getState().addNumber(1);
      }).not.toThrow();
    });

    it("Does not throw when inserting multiple arrays into arrays.", () => {
      type Store = {
        arrays: Array<any>[];
        addArray: (array: any[]) => void;
      };

      const doc = new Y.Doc();

      const api = createVanilla<Store, [["zustand/immer", unknown]]>(
        yjsImmer(
          (set) => ({
            arrays: [],
            addArray: (array) =>
              set((state) => ({
                arrays: [...state.arrays, array],
              })),
          }),
          {
            doc: doc,
            name: "hello",
          }
        )
      );

      expect(api.getState().arrays).toEqual([]);

      expect(() => {
        api.getState().addArray([1, 2, 3, 4]);
        api.getState().addArray(["foo", "bar", "baz"]);
      }).not.toThrow();
    });

    it("Does not throw when inserting multiple maps into arrays.", () => {
      type Store = {
        users: { name: string; status: "online" | "offline" }[];
        addUser: (name: string, status: "online" | "offline") => void;
      };

      const doc = new Y.Doc();

      const api = createVanilla<Store, [["zustand/immer", unknown]]>(
        yjsImmer(
          (set) => ({
            users: <{ name: string; status: "online" | "offline" }[]>[],
            addUser: (name, status) =>
              set((state) => ({
                users: [
                  ...state.users,
                  {
                    name: name,
                    status: status,
                  },
                ],
              })),
          }),
          {
            doc: doc,
            name: "hello",
          }
        )
      );

      expect(api.getState().users).toEqual([]);

      expect(() => {
        api.getState().addUser("alice", "offline");
        api.getState().addUser("bob", "offline");
      }).not.toThrow();
    });
  });

  // See issue #42
  describe("When unsetting contents of an object", () => {
    it("Does not crash on subsequent update", () => {
      type Store = {
        count: number;
        columns: Record<string, any>[];

        increment: () => void;
        setColumns: (object: Record<string, any>) => void;
        removeColumns: () => void;
      };

      const doc = new Y.Doc();

      const api = createVanilla<Store, [["zustand/immer", unknown]]>(
        yjsImmer(
          (set) => ({
            count: 0,
            columns: [],
            increment: () =>
              set((state) => ({
                ...state,
                count: state.count + 1,
              })),
            setColumns: (object: Record<string, any>) =>
              set({
                columns: [{ dataObject: [object] }],
              }),
            removeColumns: () =>
              set({
                columns: [{ dataObject: undefined }],
              }),
          }),
          {
            doc: doc,
            name: "hello",
          }
        )
      );

      expect(() => {
        api.getState().setColumns({ foo: "bar" });
        api.getState().removeColumns();
        api.getState().increment();
      }).not.toThrow();
    });
  });

  // See issue #49
  describe("When nesting strings into arrays and objects", () => {
    it("Does not crash", () => {
      type Store = {
        foo: { bar: string };
        updateFoo: (s: string) => void;
      };

      const doc = new Y.Doc();

      const api = createVanilla<Store, [["zustand/immer", unknown]]>(
        yjsImmer(
          (set) => ({
            foo: {
              bar: "baz",
            },
            updateFoo: (s: string) =>
              set((state) => ({ ...state, foo: { bar: s } })),
          }),
          {
            doc: doc,
            name: "hello",
          }
        )
      );

      expect(() => {
        api.getState().updateFoo("bingo");
        api.getState().updateFoo("bango"); // Always on subsequent update
      }).not.toThrow();
    });
  });
});

describe("Yjs middleware with network provider", () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let server: ChildProcess;
  const port = 1234;

  const waitForProviderToConnect = async (provider: WebsocketProvider) =>
    new Promise<void>((resolve) => {
      (function waitForFoo() {
        if (provider.wsconnected) return resolve();
        setTimeout(waitForFoo, 30);
      })();
    });

  // Startup y-websocket demo server for test.
  beforeEach(async () => {
    server = spawn("node", ["./node_modules/y-websocket/bin/server.js"], {
      cwd: path.resolve(__dirname, ".."),
      windowsHide: true,
      env: {
        ...process.env,
        HOST: "localhost",
        PORT: port.toString(),
      },
    });

    // Wait for the server to be ready before running the tests.
    await new Promise<void>((resolve) => {
      server.stdout?.on("readable", () => {
        server.stdout?.removeAllListeners();
        resolve();
      });
    });
  });

  // Kill y-websocket demo server after test has completed.
  afterEach(() => {
    server.kill();
  });

  it("Does not reset state on second join.", async () => {
    const address = `ws://localhost:${port}`;
    const roomName = "room";
    const mapName = "shared";

    type State = {
      count: number;
      increment: () => void;
    };

    const doc1 = new Y.Doc();
    const provider1 = new WebsocketProvider(address, roomName, doc1, {
      WebSocketPolyfill: require("ws"),
    });
    const store1 = createVanilla<State, [["zustand/immer", unknown]]>(
      yjsImmer(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }),
        {
          doc: doc1,
          name: mapName,
        }
      )
    );

    await waitForProviderToConnect(provider1);

    store1.getState().increment();

    expect(store1.getState().count).toBe(1);

    const doc2 = new Y.Doc();
    const provider2 = new WebsocketProvider(address, roomName, doc2, {
      WebSocketPolyfill: require("ws"),
    });
    const store2 = createVanilla<State, [["zustand/immer", unknown]]>(
      yjsImmer(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }),
        {
          doc: doc2,
          name: mapName,
        }
      )
    );

    await waitForProviderToConnect(provider2);

    expect(store1.getState().count).toBe(1);
    expect(store2.getState().count).toBe(1);

    store1.getState().increment();

    expect(store1.getState().count).toBe(2);
    expect(store2.getState().count).toBe(2);

    provider1.awareness.destroy();
    provider1.destroy();
    provider2.awareness.destroy();
    provider2.destroy();
  });
});

describe("Yjs middleware in React", () => {
  /**
   * See Issue 37.
   */
  it("Functions in nested objects are not converted to plain objects.", () => {
    type Store = {
      count: number;
      increment: () => void;
      someOtherData: any;
    };

    const doc = new Y.Doc();

    const useStore = create<Store, [["zustand/immer", unknown]]>(
      yjsImmer(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
          someOtherData: {
            foo: () => "bar",
          },
        }),
        {
          doc: doc,
          name: "hello",
        }
      )
    );

    const { result } = renderHook(() =>
      useStore(({ count, increment, someOtherData }) => ({
        count: count,
        increment: increment,
        someOtherData: someOtherData,
      }))
    );

    act(() => {
      result.current.increment();
    });

    expect(typeof result.current.someOtherData.foo).toBe("function");
  });

  /**
   * See Issue 41.
   */
  it("Zustand is properly notified of updates from remote peer.", () => {
    type Store = {
      count: number;
      increment: () => void;
    };

    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    doc1.on("update", (update: any) => {
      const before = doc2.getMap("hello").get("count");
      Y.applyUpdate(doc2, update);
      const after = doc2.getMap("hello").get("count");
      console.log("updating doc2", before, after);
    });

    doc2.on("update", (update: any) => {
      const before = doc1.getMap("hello").get("count");
      Y.applyUpdate(doc1, update);
      const after = doc1.getMap("hello").get("count");
      console.log("updating doc1", before, after);
    });

    const useStore1 = create<Store, [["zustand/immer", unknown]]>(
      yjsImmer(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }),
        {
          doc: doc1,
          name: "hello",
        }
      )
    );

    const useStore2 = create<Store, [["zustand/immer", unknown]]>(
      yjsImmer(
        (set) => ({
          count: 0,
          increment: () =>
            set((state) => {
              state.count += 1;
            }),
        }),
        {
          doc: doc2,
          name: "hello",
        }
      )
    );

    const { result: result1 } = renderHook(() =>
      useStore1(({ count, increment }) => ({
        count: count,
        increment: increment,
      }))
    );

    const { result: result2 } = renderHook(() =>
      useStore2(({ count, increment }) => ({
        count: count,
        increment: increment,
      }))
    );

    act(() => {
      console.log("calling increment");
      result1.current.increment();
    });

    expect(doc2.getMap("hello").get("count")).toBe(1); // Sanity check
    expect(result2.current.count).toBe(1); // Actual issue
  });
});
