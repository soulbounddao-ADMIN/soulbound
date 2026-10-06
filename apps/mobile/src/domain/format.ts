import type { VoteOutcome } from "../api/types";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return `${formatDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isClosingSoon(value: string, now: number = Date.now()): boolean {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return false;
  }
  const remaining = time - now;
  return remaining > 0 && remaining <= 24 * 60 * 60 * 1000;
}

export function formatCandidateToken(candidateToken: string): string {
  return `신청 #${candidateToken.replace(/^candidate-/, "")}`;
}

export function voteOutcomeLabel(outcome: VoteOutcome | null): string | null {
  if (outcome === "approved") {
    return "가결";
  }
  if (outcome === "rejected") {
    return "부결";
  }
  return null;
}
