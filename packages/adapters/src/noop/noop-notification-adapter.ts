import type { NotificationPort, NotifyInput } from "@soulbound/core";

export class NoopNotificationAdapter implements NotificationPort {
  async notify(_input: NotifyInput): Promise<void> {
    return undefined;
  }
}

export function makeNoopNotificationAdapter(): NotificationPort {
  return new NoopNotificationAdapter();
}
