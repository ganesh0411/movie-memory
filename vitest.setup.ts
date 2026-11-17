import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@/test/msw";

// Fail loudly on any request a test didn't mock.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
