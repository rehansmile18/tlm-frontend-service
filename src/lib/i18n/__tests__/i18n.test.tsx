import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { I18nProvider, useTranslation } from "../i18n";
import { AuthProvider } from "../../auth";
import { setSession, clearSession } from "../../auth-store";

// AuthProvider calls useRouter() (only used for logout's redirect, never exercised here) — no
// AppRouterContext exists in this jsdom-only test environment, so it's mocked rather than pulling
// in Next's full router test harness for a hook this file never triggers.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

function Probe() {
  const { locale, dir, t, setLocale, tOptional } = useTranslation();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="nav-dashboard">{t("nav.dashboard")}</span>
      <span data-testid="nav-sites">{t("nav.sites")}</span>
      <span data-testid="sites-none-found">{t("sites.noneFound")}</span>
      <span data-testid="page-of-total">{t("common.pageOfTotal", { page: 2, totalPages: 5, total: 42 })}</span>
      <span data-testid="unknown-key">{tOptional("employees.notARealField") ?? "MISS"}</span>
      <button onClick={() => setLocale("ar")}>go-arabic</button>
      <button onClick={() => setLocale("es")}>go-spanish</button>
      <button onClick={() => setLocale("en")}>go-english</button>
    </div>
  );
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>{ui}</I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const demoUser = {
  userId: "u1",
  email: "a@b.c",
  role: "CLIENT_ADMIN" as const,
  clientId: "c1",
  siteIds: [],
  permissions: [],
};

describe("I18nProvider / useTranslation", () => {
  afterEach(() => {
    localStorage.clear();
    clearSession();
    vi.restoreAllMocks();
    document.documentElement.removeAttribute("dir");
    document.documentElement.removeAttribute("lang");
  });

  it("defaults to English/LTR and resolves a nested key", () => {
    renderWithProviders(<Probe />);
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByTestId("dir")).toHaveTextContent("ltr");
    expect(screen.getByTestId("nav-dashboard")).toHaveTextContent("Dashboard");
  });

  it("interpolates {params} into the resolved string", () => {
    renderWithProviders(<Probe />);
    expect(screen.getByTestId("page-of-total")).toHaveTextContent("Page 2 of 5 · 42 total");
  });

  it("tOptional returns undefined (rendered as MISS here) for a key that doesn't exist", () => {
    renderWithProviders(<Probe />);
    expect(screen.getByTestId("unknown-key")).toHaveTextContent("MISS");
  });

  it("switches locale and flips dir to rtl for Arabic, syncing <html dir>/<html lang>", async () => {
    renderWithProviders(<Probe />);

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
    renderWithProviders(<Probe />);

    await act(async () => {
      screen.getByText("go-spanish").click();
    });

    expect(screen.getByTestId("dir")).toHaveTextContent("ltr");
    expect(screen.getByTestId("nav-dashboard")).toHaveTextContent("Panel");
  });

  it("persists the chosen locale across a remount", async () => {
    const { unmount } = renderWithProviders(<Probe />);
    await act(async () => {
      screen.getByText("go-arabic").click();
    });
    unmount();

    renderWithProviders(<Probe />);
    expect(screen.getByTestId("locale")).toHaveTextContent("ar");
  });

  describe("client module-label overrides", () => {
    it("substitutes the client's custom module name into every string in that module's namespace, leaving other keys untouched", async () => {
      setSession("tok", demoUser);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              client: {
                _id: "c1",
                name: "Acme",
                moduleLabels: {
                  sites: {
                    en: { singular: "Business Unit", plural: "Business Units" },
                    es: { singular: "Unidad de Negocio", plural: "Unidades de Negocio" },
                    ar: { singular: "وحدة عمل", plural: "وحدات عمل" },
                  },
                },
              },
            }),
            { status: 200 }
          )
        )
      );

      renderWithProviders(<Probe />);

      // The client query is async — wait for the override to land.
      await waitFor(() => expect(screen.getByTestId("nav-sites")).toHaveTextContent("Business Units"));

      expect(screen.getByTestId("sites-none-found")).toHaveTextContent("No Business Units found");
      // Unrelated module's strings are untouched.
      expect(screen.getByTestId("nav-dashboard")).toHaveTextContent("Dashboard");
    });

    it("falls back to the built-in name when the client has no override", async () => {
      setSession("tok", demoUser);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ client: { _id: "c1", name: "Acme", moduleLabels: null } }), { status: 200 })
        )
      );

      renderWithProviders(<Probe />);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByTestId("nav-sites")).toHaveTextContent("Sites");
    });
  });
});
