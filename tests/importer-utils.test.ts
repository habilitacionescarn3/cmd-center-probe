import { describe, expect, it } from "vitest";

import {
  clampDowntimeMinutes,
  extractApplications,
  normalizeSeverity,
} from "@/server/importer/xlsx-importer";
import { Severity } from "@prisma/client";

describe("importer utils", () => {
  it("normalizes severity text values", () => {
    expect(normalizeSeverity("P1")).toBe(Severity.P1);
    expect(normalizeSeverity("alto")).toBe(Severity.P2);
    expect(normalizeSeverity("médio")).toBe(Severity.P3);
    expect(normalizeSeverity("desconhecido")).toBe(Severity.P3);
  });

  it("extracts applications with multiple separators", () => {
    expect(extractApplications("Checkout; Payments / Search")).toEqual([
      "Checkout",
      "Payments",
      "Search",
    ]);
  });

  it("ignores downtime for severities other than P1/P2", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    const later = new Date("2025-01-01T01:00:00Z");
    const windowStart = new Date("2025-01-01T00:00:00Z");
    const windowEnd = new Date("2025-12-31T23:59:00Z");

    expect(
      clampDowntimeMinutes(Severity.P3, now, later, windowStart, windowEnd),
    ).toBe(0);
  });

  it("clamps downtime to analysis window", () => {
    const windowStart = new Date("2025-01-01T00:00:00Z");
    const windowEnd = new Date("2025-12-31T23:59:00Z");
    const startedAt = new Date("2024-12-31T23:50:00Z");
    const resolvedAt = new Date("2025-01-01T00:20:00Z");

    const downtime = clampDowntimeMinutes(
      Severity.P1,
      startedAt,
      resolvedAt,
      windowStart,
      windowEnd,
    );

    expect(downtime).toBe(20);
  });
});
