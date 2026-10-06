import { describe, expect, it, vi } from "vitest";
import { createReloadGuard, watchForWaitingWorker } from "./sw-update";

class FakeWorker extends EventTarget {
  state: ServiceWorkerState = "installing";
  postMessage = vi.fn();
  setState(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
}

function asRegistration(value: FakeRegistration) {
  return value as unknown as ServiceWorkerRegistration;
}

const controlled = { controller: {} as ServiceWorker };
const uncontrolled = { controller: null };

describe("watchForWaitingWorker", () => {
  it("reports an already-waiting worker when the page is controlled", () => {
    const registration = new FakeRegistration();
    registration.waiting = new FakeWorker();
    const onUpdateReady = vi.fn();
    watchForWaitingWorker(asRegistration(registration), controlled, {
      onUpdateReady,
    });
    expect(onUpdateReady).toHaveBeenCalledWith(registration.waiting);
  });

  it("reports a worker that finishes installing after updatefound", () => {
    const registration = new FakeRegistration();
    const onUpdateReady = vi.fn();
    watchForWaitingWorker(asRegistration(registration), controlled, {
      onUpdateReady,
    });
    const worker = new FakeWorker();
    registration.installing = worker;
    registration.dispatchEvent(new Event("updatefound"));
    expect(onUpdateReady).not.toHaveBeenCalled();
    registration.waiting = worker;
    worker.setState("installed");
    expect(onUpdateReady).toHaveBeenCalledWith(worker);
  });

  it("never prompts on the first install (no controller yet)", () => {
    const registration = new FakeRegistration();
    const onUpdateReady = vi.fn();
    watchForWaitingWorker(asRegistration(registration), uncontrolled, {
      onUpdateReady,
    });
    const worker = new FakeWorker();
    registration.installing = worker;
    registration.dispatchEvent(new Event("updatefound"));
    registration.waiting = worker;
    worker.setState("installed");
    expect(onUpdateReady).not.toHaveBeenCalled();
  });

  it("stops reporting after dispose", () => {
    const registration = new FakeRegistration();
    const onUpdateReady = vi.fn();
    const dispose = watchForWaitingWorker(asRegistration(registration), controlled, {
      onUpdateReady,
    });
    dispose();
    const worker = new FakeWorker();
    registration.installing = worker;
    registration.dispatchEvent(new Event("updatefound"));
    registration.waiting = worker;
    worker.setState("installed");
    expect(onUpdateReady).not.toHaveBeenCalled();
  });
});

describe("createReloadGuard", () => {
  it("ignores controllerchange until the user accepts the update", () => {
    const reload = vi.fn();
    const guard = createReloadGuard(reload);
    expect(guard.onControllerChange()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads exactly once after acceptance", () => {
    const reload = vi.fn();
    const guard = createReloadGuard(reload);
    guard.accept();
    expect(guard.onControllerChange()).toBe(true);
    expect(guard.onControllerChange()).toBe(false);
    guard.accept();
    expect(guard.onControllerChange()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
