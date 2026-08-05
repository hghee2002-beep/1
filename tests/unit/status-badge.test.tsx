import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/system/status-badge";

describe("StatusBadge", () => {
  it("renders the supplied status as readable text", () => {
    render(<StatusBadge label="Foundation ready" tone="ready" />);

    expect(screen.getByText("Foundation ready")).toBeVisible();
  });

  it("keeps warning state readable without relying on color", () => {
    render(<StatusBadge label="동기화 지연" tone="stale" />);

    expect(screen.getByText("동기화 지연")).toBeVisible();
  });
});
