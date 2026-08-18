/** Share one in-flight Promise — set the map entry before `start()` runs. */
export function startSharedInflight<T>(
  inflight: Map<string, Promise<T>>,
  key: string,
  start: () => Promise<T>,
): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending;

  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  inflight.set(key, promise);

  try {
    void start().then(resolve, reject);
  } catch (err) {
    reject(err);
  }

  void promise.finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  return promise;
}
