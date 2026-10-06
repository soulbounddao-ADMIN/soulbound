"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecorderMimeCandidate = {
  readonly recordingMimeType: string;
  readonly uploadMimeType: "video/webm" | "video/mp4";
};

const RECORDER_MIME_CANDIDATES: readonly RecorderMimeCandidate[] = [
  { recordingMimeType: "video/webm", uploadMimeType: "video/webm" },
  {
    recordingMimeType: "video/webm;codecs=vp8,opus",
    uploadMimeType: "video/webm",
  },
  { recordingMimeType: "video/mp4", uploadMimeType: "video/mp4" },
  {
    recordingMimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    uploadMimeType: "video/mp4",
  },
];
const MAX_DURATION_SECONDS = 600;

export type PersonaClipResult = {
  assetId: string;
  contentHash: string;
};

export type PersonaClipRecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "uploading"
  | "done"
  | "unavailable"
  | "error"
  | "skipped";

type UploadContract = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

type CreateClipResponse = {
  assetId: string;
  upload: UploadContract;
};

type RecorderRouteFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type UsePersonaClipRecorderOptions = {
  onComplete: (result: PersonaClipResult) => void;
  onSkip: () => void;
  authedFetch?: RecorderRouteFetch;
};

function isCreateClipResponse(value: unknown): value is CreateClipResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CreateClipResponse>;
  const headers = candidate.upload?.headers;

  return (
    typeof candidate.assetId === "string"
    && typeof candidate.upload?.url === "string"
    && candidate.upload.method === "PUT"
    && Boolean(headers)
    && typeof headers === "object"
    && Object.values(headers).every((header) => typeof header === "string")
  );
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function selectRecorderMimeType(): RecorderMimeCandidate | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  if (typeof MediaRecorder.isTypeSupported !== "function") {
    return RECORDER_MIME_CANDIDATES[0] ?? null;
  }

  return RECORDER_MIME_CANDIDATES.find((candidate) => {
    try {
      return MediaRecorder.isTypeSupported(candidate.recordingMimeType);
    } catch {
      return false;
    }
  }) ?? null;
}

export function usePersonaClipRecorder({
  onComplete,
  onSkip,
  authedFetch,
}: UsePersonaClipRecorderOptions) {
  const [status, setStatus] = useState<PersonaClipRecorderStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const operationRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const durationSecondsRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  const isActiveOperation = useCallback(
    (operation: number) =>
      mountedRef.current && operationRef.current === operation,
    [],
  );

  const releaseStream = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (mountedRef.current) {
      setStream(null);
    }
  }, []);

  const setRetryableError = useCallback((operation: number) => {
    if (!isActiveOperation(operation)) {
      return;
    }
    setErrorMessage(
      "Persona Clip을 준비하지 못했습니다. 다시 시도하거나 건너뛸 수 있습니다.",
    );
    busyRef.current = false;
    setStatus("error");
  }, [isActiveOperation]);

  const uploadRecording = useCallback(async (
    operation: number,
    blob: Blob,
    uploadMimeType: RecorderMimeCandidate["uploadMimeType"],
  ) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (blob.size === 0) {
        throw new Error("empty recording");
      }

      const contentHash = await sha256Hex(blob);
      if (!isActiveOperation(operation)) {
        return;
      }

      const routeFetch = authedFetch ?? globalThis.fetch;
      const createResponse = await routeFetch("/api/admission/persona-clip", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentHash,
          mimeType: uploadMimeType,
          durationSeconds: durationSecondsRef.current,
        }),
        signal: controller.signal,
      });
      if (!createResponse.ok) {
        throw new Error("persona clip creation failed");
      }

      const payload: unknown = await createResponse.json();
      if (!isCreateClipResponse(payload)) {
        throw new Error("invalid persona clip upload contract");
      }

      const uploadResponse = await globalThis.fetch(payload.upload.url, {
        method: payload.upload.method,
        headers: payload.upload.headers,
        body: blob,
        signal: controller.signal,
      });
      if (!uploadResponse.ok) {
        throw new Error("persona clip upload failed");
      }

      if (!isActiveOperation(operation)) {
        return;
      }
      busyRef.current = false;
      setStatus("done");
      onCompleteRef.current({ assetId: payload.assetId, contentHash });
    } catch (error) {
      if (
        error instanceof DOMException
        && error.name === "AbortError"
      ) {
        return;
      }
      setRetryableError(operation);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [authedFetch, isActiveOperation, setRetryableError]);

  const start = useCallback(async () => {
    if (
      busyRef.current
      || status === "requesting"
      || status === "recording"
      || status === "uploading"
    ) {
      return;
    }

    busyRef.current = true;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setErrorMessage(null);
    setStatus("requesting");

    const recorderMimeType = selectRecorderMimeType();

    if (
      typeof navigator === "undefined"
      || !navigator.mediaDevices?.getUserMedia
      || !recorderMimeType
    ) {
      if (isActiveOperation(operation)) {
        busyRef.current = false;
        setStatus("unavailable");
      }
      return;
    }

    let capture: MediaStream | null = null;
    try {
      capture = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (!isActiveOperation(operation)) {
        stopStream(capture);
        return;
      }

      const recorder = new MediaRecorder(capture, {
        mimeType: recorderMimeType.recordingMimeType,
      });
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      durationSecondsRef.current = 0;
      streamRef.current = capture;
      recorderRef.current = recorder;
      setStream(capture);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        releaseStream();
        recorderRef.current = null;
        setRetryableError(operation);
      };
      recorder.onstop = () => {
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: recorderMimeType.uploadMimeType,
        });
        void uploadRecording(operation, blob, recorderMimeType.uploadMimeType);
      };

      recorder.start();
      setStatus("recording");
    } catch {
      stopStream(capture);
      if (isActiveOperation(operation)) {
        busyRef.current = false;
        streamRef.current = null;
        setStream(null);
        setStatus("unavailable");
      }
    }
  }, [
    isActiveOperation,
    releaseStream,
    setRetryableError,
    status,
    uploadRecording,
  ]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return;
    }

    durationSecondsRef.current = Math.min(
      MAX_DURATION_SECONDS,
      Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)),
    );
    setStatus("uploading");
    recorder.stop();
    releaseStream();
  }, [releaseStream]);

  const skip = useCallback(() => {
    busyRef.current = false;
    operationRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }

    releaseStream();
    setErrorMessage(null);
    setStatus("skipped");
    onSkipRef.current();
  }, [releaseStream]);

  useEffect(() => () => {
    mountedRef.current = false;
    operationRef.current += 1;
    abortControllerRef.current?.abort();

    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  return {
    status,
    stream,
    errorMessage,
    start,
    stop,
    skip,
  };
}
