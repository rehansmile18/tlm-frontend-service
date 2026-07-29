import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { I18nProvider, useTranslation } from "../i18n";

function Probe() {
  const { locale, dir, t, setLocale, tOptional } = useTranslation();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="nav-dashboard">{t("nav.dashboard")}</span>
      <span data-testid="page-of-total">{t("common.pageOfTotal", { page: 2, totalPages: 5, total: 42 })}</span>
      <span data-testid="unknown-key">{tOptional("employees.notARealField") ?? "MISS"}</span>
      <button onClick={() => setLocale("ar")}>go-arabic</button>
      <button onClick={() => setLocale("es")}>go-spanish</button>
      <button onClick={() => setLocale("en")}>go-english</button>
    </div>
  );
}

describe("I18nProvider / useTranslation", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("dir");
    document.documentElement.removeAttribute("lang");
  });

  it("defaults to English/LTR and resolves a nested key", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByTestId("dir")).toHaveTextContent("ltr");
    expect(screen.getByTestId("nav-dashboard")).toHaveTextContent("Dashboard");
  });

  it("interpolates {params} into the resolved string", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByTestId("page-of-total")).toHaveTextContent("Page 2 of 5 · 42 total");
  });

  it("tOptional returns undefined (rendered as MISS here) for a key that doesn't exist", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByTestId("unknown-key")).toHaveTextContent("MISS");
  });

  it("switches locale and flips dir to rtl for Arabic, syncing <html dir>/<html lang>", async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    await act(async () => {
      screen.getByText("go-arabic").click();
    });

    expect(screen.getByTestId("locale")).toHaveTextContent("ar");
    expect(screen.getByTestId("dir")).toHaveTextContent("rtl");
    expect(screen.getByTestId("nav-dashboard")).toHaveTextContent("لوحة التحكم");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });

  it("Spanish stays LTR", async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    await act(async () => {
      screen.getByText("go-spanish").click();
    });

    expect(screen.getByTestId("dir")).toHaveTextContent("ltr");
    expect(screen.getByTestId("nav-dashboard")).toHaveTextContent("Panel");
  });

  it("persists the chosen locale across a remount", async () => {
    const { unmount } = render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    await act(async () => {
      screen.getByText("go-arabic").click();
    });
    unmount();

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("ar");
  });
});
