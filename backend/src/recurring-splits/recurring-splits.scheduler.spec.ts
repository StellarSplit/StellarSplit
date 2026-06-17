import { RecurringSplitsScheduler } from "./recurring-splits.scheduler";

function makeScheduler() {
  const service = {
    getRecurringSplitsDueForProcessing: jest.fn().mockResolvedValue([]),
    getRecurringSplitsDueForReminders: jest.fn().mockResolvedValue([]),
    getAllActiveRecurringSplits: jest.fn().mockResolvedValue([]),
  };
  const gateway = {
    emitSplitCompletion: jest.fn(),
    emitPaymentNotification: jest.fn(),
  };
  // Cast via unknown to avoid needing full constructor deps in tests
  const scheduler = new (RecurringSplitsScheduler as any)(service, gateway);
  return { scheduler, service };
}

describe("RecurringSplitsScheduler – NODE_ENV test guard", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("processRecurringSplits exits immediately in test env", async () => {
    const { scheduler, service } = makeScheduler();
    await scheduler.processRecurringSplits();
    expect(service.getRecurringSplitsDueForProcessing).not.toHaveBeenCalled();
  });

  it("sendRecurringSplitReminders exits immediately in test env", async () => {
    const { scheduler, service } = makeScheduler();
    await scheduler.sendRecurringSplitReminders();
    expect(service.getRecurringSplitsDueForReminders).not.toHaveBeenCalled();
  });

  it("cleanupExpiredRecurringSplits exits immediately in test env", async () => {
    const { scheduler, service } = makeScheduler();
    await scheduler.cleanupExpiredRecurringSplits();
    expect(service.getAllActiveRecurringSplits).not.toHaveBeenCalled();
  });

  it("processRecurringSplits calls service when NODE_ENV is not test", async () => {
    process.env.NODE_ENV = "production";
    const { scheduler, service } = makeScheduler();
    await scheduler.processRecurringSplits();
    expect(service.getRecurringSplitsDueForProcessing).toHaveBeenCalledTimes(1);
  });
});
