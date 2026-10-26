// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CheckboxTile, ChoiceGroup, type Choice } from "./choice-group";

afterEach(cleanup);

const DEGREES: Choice<string>[] = [
  { value: "legere", label: "Légère" },
  { value: "moyenne", label: "Moyenne" },
  { value: "severe", label: "Sévère" },
  { value: "profonde", label: "Profonde", hint: "≥ 90 dB" },
];

function Harness({
  initial = null,
  readOnly = false,
  onChange,
}: {
  initial?: string | null;
  readOnly?: boolean;
  onChange?: (v: string | null) => void;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <>
      <span id="degree-label">Degré de surdité</span>
      <ChoiceGroup
        id="degree"
        label="Degré de surdité"
        value={value}
        readOnly={readOnly}
        onChange={(v) => {
          onChange?.(v);
          setValue(v);
        }}
        options={DEGREES}
      />
    </>
  );
}

const radio = (name: string | RegExp) => screen.getByRole("radio", { name });

describe("ChoiceGroup", () => {
  it("expose un groupe radio nommé ; l'indication fait partie du nom", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "Degré de surdité" })).toBeTruthy();
    expect(radio("Profonde ≥ 90 dB")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("n'a qu'un arrêt de tabulation : l'option choisie, sinon la première", () => {
    const { unmount } = render(<Harness />);
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
    unmount();
    render(<Harness initial="severe" />);
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([-1, -1, 0, -1]);
  });

  it("déplace le focus avec la sélection (flèches, Début, Fin, boucle)", () => {
    render(<Harness initial="moyenne" />);
    radio("Moyenne").focus();
    fireEvent.keyDown(radio("Moyenne"), { key: "ArrowRight" });
    expect(radio("Sévère").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radio("Sévère"));

    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(radio(/Profonde/));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(radio("Légère"));
    expect(radio("Légère").getAttribute("aria-checked")).toBe("true");

    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(radio(/Profonde/));
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(radio("Légère"));
  });

  it("part de l'option focalisée quand rien n'est choisi", () => {
    render(<Harness />);
    radio("Moyenne").focus();
    fireEvent.keyDown(radio("Moyenne"), { key: "ArrowRight" });
    expect(radio("Sévère").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radio("Sévère"));
  });

  it("désélectionne au second clic", () => {
    render(<Harness initial="moyenne" />);
    fireEvent.click(radio("Moyenne"));
    expect(screen.getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);
  });

  it("en lecture seule, le focus se déplace mais la valeur ne change pas", () => {
    const onChange = vi.fn();
    render(<Harness initial="moyenne" readOnly onChange={onChange} />);
    expect(screen.getByRole("radiogroup").getAttribute("aria-readonly")).toBe("true");
    fireEvent.click(radio("Légère"));
    radio("Moyenne").focus();
    fireEvent.keyDown(radio("Moyenne"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(radio("Sévère"));
    expect(onChange).not.toHaveBeenCalled();
    expect(radio("Moyenne").getAttribute("aria-checked")).toBe("true");
  });
});

describe("CheckboxTile", () => {
  it("bascule et transmet les attributs du bouton", () => {
    const onCheckedChange = vi.fn();
    render(
      <CheckboxTile checked={false} onCheckedChange={onCheckedChange} data-testid="exam-bilan">
        Bilan auditif
      </CheckboxTile>,
    );
    const box = screen.getByRole("checkbox", { name: "Bilan auditif" });
    expect(box.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByTestId("exam-bilan")).toBe(box);
    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
