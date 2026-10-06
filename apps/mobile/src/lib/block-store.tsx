import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { blockMember, listMyBlocks, unblockMember } from "../api/endpoints";
import { useAuth } from "../auth/auth-provider";
import { secureKeyValueStore } from "../auth/secure-store";
import { parseBlockedMembers } from "./safety";

const STORAGE_KEY = "soulbound.blocked-members";

interface BlockContextValue {
  readonly blocked: readonly number[];
  readonly syncError: string;
  readonly isBlocked: (memberNumber: number) => boolean;
  readonly setBlocked: (memberNumber: number, blocked: boolean) => Promise<boolean>;
  readonly toggle: (memberNumber: number) => Promise<boolean>;
  readonly refresh: () => Promise<void>;
}

const BlockContext = createContext<BlockContextValue | null>(null);

function persist(list: readonly number[]): void {
  void secureKeyValueStore.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => undefined);
}

// Server (/api/blocks) is the source of truth and filters board/member
// responses. The secure-store copy is only an optimistic, offline hide cache.
export function BlockProvider({ children }: { readonly children: ReactNode }) {
  const { api, signedIn } = useAuth();
  const [blocked, setBlockedList] = useState<readonly number[]>([]);
  const [syncError, setSyncError] = useState("");
  const blockedRef = useRef<readonly number[]>([]);

  const update = useCallback((next: readonly number[]) => {
    blockedRef.current = next;
    setBlockedList(next);
    persist(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await listMyBlocks(api);
      if (result.ok && result.data) {
        update(result.data.items.map((item) => item.memberNumber));
        setSyncError("");
      } else if (result.status !== 401) {
        setSyncError("차단 목록을 불러오지 못했습니다.");
      }
    } catch {
      setSyncError("차단 목록을 불러오지 못했습니다.");
    }
  }, [api, update]);

  useEffect(() => {
    if (!signedIn) {
      blockedRef.current = [];
      setBlockedList([]);
      void secureKeyValueStore.removeItem(STORAGE_KEY).catch(() => undefined);
      return;
    }
    void secureKeyValueStore.getItem(STORAGE_KEY)
      .then((raw) => {
        if (blockedRef.current.length === 0) {
          const cached = parseBlockedMembers(raw);
          blockedRef.current = cached;
          setBlockedList(cached);
        }
      })
      .catch(() => undefined)
      .finally(() => void refresh());
  }, [refresh, signedIn]);

  const setBlocked = useCallback(async (memberNumber: number, nextBlocked: boolean) => {
    const previous = blockedRef.current;
    update(nextBlocked
      ? [...new Set([...previous, memberNumber])]
      : previous.filter((value) => value !== memberNumber));
    try {
      const result = nextBlocked
        ? await blockMember(api, memberNumber)
        : await unblockMember(api, memberNumber);
      if (result.ok) {
        setSyncError("");
        return true;
      }
    } catch {
      // fall through to revert
    }
    update(previous);
    setSyncError(nextBlocked ? "차단하지 못했습니다." : "차단을 해제하지 못했습니다.");
    return false;
  }, [api, update]);

  const toggle = useCallback(
    (memberNumber: number) => setBlocked(memberNumber, !blockedRef.current.includes(memberNumber)),
    [setBlocked],
  );

  const value = useMemo<BlockContextValue>(() => ({
    blocked,
    syncError,
    isBlocked: (memberNumber) => blocked.includes(memberNumber),
    setBlocked,
    toggle,
    refresh,
  }), [blocked, refresh, setBlocked, syncError, toggle]);

  return <BlockContext.Provider value={value}>{children}</BlockContext.Provider>;
}

export function useBlocks(): BlockContextValue {
  const value = useContext(BlockContext);
  if (!value) {
    throw new Error("useBlocks must be used within BlockProvider");
  }
  return value;
}
