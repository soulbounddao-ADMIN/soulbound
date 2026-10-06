import { NoopLedgerAdapter } from "./noop-ledger-adapter";
import { NoopNotificationAdapter } from "./noop-notification-adapter";

describe("Noop adapters", () => {
  it("returns skipped ledger receipts without side effects", async () => {
    const adapter = new NoopLedgerAdapter();

    await expect(
      adapter.issueMembershipCredential({
        userId: "user-1",
        applicationId: "app-1",
        idempotencyKey: "idem-1",
      }),
    ).resolves.toEqual({
      chain: "none",
      status: "skipped",
    });
  });

  it("accepts notifications as a no-op", async () => {
    const adapter = new NoopNotificationAdapter();

    await expect(
      adapter.notify({
        userId: "user-1",
        kind: "admission.updated",
      }),
    ).resolves.toBeUndefined();
  });
});
