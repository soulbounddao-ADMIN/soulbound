// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePersonaClipRecorder } from "./use-persona-clip-recorder";

const allowedMimeTypes = [
  "video/webm",
  "video/mp4",
  "audio/webm",
  "audio/mp4",
];

const recordedChunk = new Blob(["persona-clip-bytes"], {
  type: "video/webm",
});

class MockMediaRecorder {
  static isTypeSupported = vi.fn((mimeType: string) => {
    void mimeType;
    return true;
  });
  static instances: MockMediaRecorder[] = [];

  state: RecordingState = "inactive";
  mimeType: string;
  ondataavailable: ((this: MediaRecorder, event: BlobEvent) => unknown) | null =
    null;
  onerror: ((this: MediaRecorder, event: Event) => unknown) | null = null;
  onstop: ((this: MediaRecorder, event: Event) => unknown) | null = null;

  constructor(
    public readonly stream: MediaStream,
    options?: MediaRecorderOptions,
  ) {
    this.mimeType = options?.mimeType ?? "";
    MockMediaRecorder.instances.push(this);
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    this.ondataavailable?.call(
      this as unknown as MediaRecorder,
      { data: recordedChunk } as BlobEvent,
    );
    this.onstop?.call(
      this as unknown as MediaRecorder,
      new Event("stop"),
    );
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("usePersonaClipRecorder", () => {
  const trackStop = vi.fn();
  const stream = {
    getTracks: () => [{ stop: trackStop }],
  } as unknown as MediaStream;
  const getUserMedia = vi.fn(async () => stream);
  let mediaDevicesDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "mediaDevices",
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal(
      "MediaRecorder",
      MockMediaRecorder as unknown as typeof MediaRecorder,
    );
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn(async () => Uint8Array.from([0xab, 0xcd]).buffer),
      },
    });
    MockMediaRecorder.instances = [];
    MockMediaRecorder.isTypeSupported.mockReset();
    MockMediaRecorder.isTypeSupported.mockReturnValue(true);
    getUserMedia.mockClear();
    trackStop.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (mediaDevicesDescriptor) {
      Object.defineProperty(
        navigator,
        "mediaDevices",
        mediaDevicesDescriptor,
      );
    } else {
      Reflect.deleteProperty(navigator, "mediaDevices");
    }
  });

  it("uploads through the route contract before completing", async () => {
    const upload = deferred<Response>();
    const events: string[] = [];
    const onComplete = vi.fn(() => events.push("complete"));
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => {
        events.push("create");
        return new Response(JSON.stringify({
          assetId: "asset-1",
          upload: {
            url: "https://storage.test/upload",
            method: "PUT",
            headers: { "x-upsert": "false" },
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      })
      .mockImplementationOnce(() => {
        events.push("upload");
        return upload.promise;
      });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(4_000);

    const { result } = renderHook(() =>
      usePersonaClipRecorder({ onComplete, onSkip: vi.fn() })
    );

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("recording");

    act(() => {
      result.current.stop();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe("uploading");
    expect(onComplete).not.toHaveBeenCalled();

    const [routeUrl, routeInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const routeBody = JSON.parse(String(routeInit.body)) as {
      contentHash: string;
      mimeType: string;
      durationSeconds: number;
    };
    expect(routeUrl).toBe("/api/admission/persona-clip");
    expect(routeInit).toMatchObject({
      method: "POST",
      credentials: "include",
    });
    expect(routeBody).toEqual({
      contentHash: "abcd",
      mimeType: "video/webm",
      durationSeconds: 3,
    });
    expect(allowedMimeTypes).toContain(routeBody.mimeType);

    const [uploadUrl, uploadInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(uploadUrl).toBe("https://storage.test/upload");
    expect(uploadInit.method).toBe("PUT");
    expect(uploadInit.headers).toEqual({ "x-upsert": "false" });
    expect(uploadInit.body).toBeInstanceOf(Blob);
    expect((uploadInit.body as Blob).type).toBe("video/webm");

    await act(async () => {
      upload.resolve(new Response(null, { status: 200 }));
      await upload.promise;
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(onComplete).toHaveBeenCalledWith({
      assetId: "asset-1",
      contentHash: "abcd",
    });
    expect(events).toEqual(["create", "upload", "complete"]);
    expect(trackStop).toHaveBeenCalled();
  });

  it("falls back to MP4 recording when WebM is unsupported", async () => {
    MockMediaRecorder.isTypeSupported.mockImplementation((mimeType) =>
      mimeType === "video/mp4"
    );
    const onComplete = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assetId: "asset-mp4",
        upload: {
          url: "https://storage.test/mp4-upload",
          method: "PUT",
          headers: { "content-type": "video/mp4" },
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      usePersonaClipRecorder({ onComplete, onSkip: vi.fn() })
    );

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("recording");
    expect(MockMediaRecorder.instances[0]?.mimeType).toBe("video/mp4");

    act(() => {
      result.current.stop();
    });

    await waitFor(() => expect(result.current.status).toBe("done"));

    const [, routeInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const routeBody = JSON.parse(String(routeInit.body)) as {
      mimeType: string;
    };
    expect(routeBody.mimeType).toBe("video/mp4");

    const [, uploadInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(uploadInit.body).toBeInstanceOf(Blob);
    expect((uploadInit.body as Blob).type).toBe("video/mp4");
    expect(onComplete).toHaveBeenCalledWith({
      assetId: "asset-mp4",
      contentHash: "abcd",
    });
  });

  it("uses injected bearer fetch for route creation and plain fetch for upload", async () => {
    const routeTransport = vi.fn(async (
      input: RequestInfo | URL,
      init: RequestInit = {},
    ) => {
      const headers = new Headers(init.headers);
      headers.set("authorization", "Bearer applicant-token");
      return globalThis.fetch(input, { ...init, headers });
    });
    const transportFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assetId: "asset-bearer",
        upload: {
          url: "https://storage.test/upload",
          method: "PUT",
          headers: { "x-upload-token": "signed" },
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", transportFetch);
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      usePersonaClipRecorder({
        onComplete,
        onSkip: vi.fn(),
        authedFetch: routeTransport,
      })
    );

    await act(async () => {
      await result.current.start();
    });
    act(() => {
      result.current.stop();
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(routeTransport).toHaveBeenCalledOnce();
    expect(routeTransport).toHaveBeenCalledWith(
      "/api/admission/persona-clip",
      expect.objectContaining({ method: "POST" }),
    );

    const [routeUrl, routeInit] = transportFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(routeUrl).toBe("/api/admission/persona-clip");
    expect(new Headers(routeInit.headers).get("authorization")).toBe(
      "Bearer applicant-token",
    );

    const [uploadUrl, uploadInit] = transportFetch.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(uploadUrl).toBe("https://storage.test/upload");
    expect(new Headers(uploadInit.headers).has("authorization")).toBe(false);
    expect(uploadInit.headers).toEqual({ "x-upload-token": "signed" });
    expect(onComplete).toHaveBeenCalledWith({
      assetId: "asset-bearer",
      contentHash: "abcd",
    });
  });

  it("does not complete when the signed upload fails", async () => {
    const onComplete = vi.fn();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assetId: "asset-2",
        upload: {
          url: "https://storage.test/upload",
          method: "PUT",
          headers: {},
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 503 })));

    const { result } = renderHook(() =>
      usePersonaClipRecorder({ onComplete, onSkip: vi.fn() })
    );

    await act(async () => {
      await result.current.start();
    });
    act(() => {
      result.current.stop();
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toContain("다시 시도");
  });

  it("does not upload a recording after MediaRecorder reports an error", async () => {
    const fetchMock = vi.fn();
    const onComplete = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      usePersonaClipRecorder({ onComplete, onSkip: vi.fn() })
    );

    await act(async () => {
      await result.current.start();
    });

    const recorder = MockMediaRecorder.instances[0];
    expect(recorder).toBeDefined();
    act(() => {
      recorder?.onerror?.call(
        recorder as unknown as MediaRecorder,
        new Event("error"),
      );
      recorder?.onstop?.call(
        recorder as unknown as MediaRecorder,
        new Event("stop"),
      );
    });

    expect(result.current.status).toBe("error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled();
  });

  it("marks camera permission rejection as unavailable", async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException(
      "permission denied",
      "NotAllowedError",
    ));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onSkip = vi.fn();
    const { result } = renderHook(() =>
      usePersonaClipRecorder({ onComplete: vi.fn(), onSkip })
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("unavailable");
    expect(onSkip).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks a missing MediaRecorder as unavailable", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    const { result } = renderHook(() =>
      usePersonaClipRecorder({ onComplete: vi.fn(), onSkip: vi.fn() })
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("unavailable");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("marks unsupported recording mime types as unavailable before requesting camera", async () => {
    MockMediaRecorder.isTypeSupported.mockReturnValue(false);
    const { result } = renderHook(() =>
      usePersonaClipRecorder({ onComplete: vi.fn(), onSkip: vi.fn() })
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("unavailable");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("skips without network access and releases an active stream", async () => {
    const fetchMock = vi.fn();
    const onSkip = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      usePersonaClipRecorder({ onComplete: vi.fn(), onSkip })
    );

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("recording");

    const skipRecording = result.current.skip;
    act(skipRecording);

    expect(result.current.status).toBe("skipped");
    expect(onSkip).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled();
  });
});
