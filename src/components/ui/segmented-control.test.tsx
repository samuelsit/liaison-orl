// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SegmentedControl, SegmentedControlItem } from "./segmented-control";

afterEach(cleanup);

function renderControl(onValueChange: (v: "color" | "grayscale") => void) {
  render(
    <SegmentedControl value="color" onValueChange={onValueChange} aria-label="Impression">
      <SegmentedControlItem value="color">Couleur</SegmentedControlItem>
      <SegmentedControlItem value="grayscale" count={3}>
        Noir et blanc
      </SegmentedControlItem>
    </SegmentedControl>,
  );
}

describe("SegmentedControl", () => {
  it("expose un groupe de boutons radio nommés", () => {
    renderControl(() => {});
    expect(screen.getByRole("radiogroup", { name: "Impression" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Couleur" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Noir et blanc/ }).textContent).toContain("3");
  });

  it("change de valeur mais ne se vide jamais", () => {
    const onValueChange = vi.fn();
    renderControl(onValueChange);
    fireEvent.click(screen.getByRole("radio", { name: "Couleur" }));
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: /Noir et blanc/ }));
    expect(onValueChange).toHaveBeenCalledWith("grayscale");
  });
});
