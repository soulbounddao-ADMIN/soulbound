/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork.
 * Do NOT change the shape or flip P0 main literals. To change, say "unfreeze contract".
 *
 * P0 main-branch values. `externalLedgerEnabled` is a HARD false literal (INV-21).
 *
 * CHAIN-NEUTRAL BY DESIGN (v1.3): P0 does NOT commit to any concrete settlement
 * chain. The only LedgerPort implementation on main is NoopLedgerAdapter. Which
 * privacy/settlement ledger (if any) backs SOUL later — that is a Northstar
 * decision made on an option branch, never on main.
 *
 * IMPORTANT: services receive FeatureFlags via deps (dependency injection),
 * NOT by importing this const directly. That lets tests inject overrides
 * (e.g. INV-13 failure-tolerance with externalLedgerEnabled:true) WITHOUT ever
 * enabling an external ledger in the real main build.
 */

export interface FeatureFlags {
  /** optional external settlement/ledger side effects (never enabled on main) */
  readonly externalLedgerEnabled: boolean;
  readonly icpBackendEnabled: boolean;
  readonly filecoinStorageEnabled: boolean;
  readonly arweavePolicyArchiveEnabled: boolean;
  readonly admissionOutboxEnabled: boolean;
  readonly auditHashChainEnabled: boolean;
  readonly realtimeChatEnabled: boolean;
  readonly aiInterviewEnabled: boolean;
  // ---- Persona Clip (admission artifact, NOT a media/message feature) ----
  readonly personaClipRecordingEnabled: boolean;
  readonly personaClipUploadEnabled: boolean;   // false: no file-upload fallback (INV-PC-04)
  readonly personaClipPreviewEnabled: boolean;  // false: no preview in initial MVP
  readonly personaClipRetakeEnabled: boolean;   // false: no retake flow in initial MVP
}

export const featureFlags: FeatureFlags = {
  externalLedgerEnabled: false, // P0 main fixed false — no concrete chain on main (INV-21)
  icpBackendEnabled: false, // INV-14
  filecoinStorageEnabled: false,
  arweavePolicyArchiveEnabled: false,
  admissionOutboxEnabled: true,
  auditHashChainEnabled: true, // DB trigger active; app may verify-read the chain
  realtimeChatEnabled: false,
  aiInterviewEnabled: false,
  personaClipRecordingEnabled: true,
  personaClipUploadEnabled: false,
  personaClipPreviewEnabled: false,
  personaClipRetakeEnabled: false,
};
