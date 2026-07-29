import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, backendFetch, tlmFetch } from "../api";
import { getToken, setSession } from "../auth-store";

const demoUser = {
  userId: "u1",
  email: "a@b.c",
  role: "VIEWER" as const,
  clientId: null,
  siteIds: [],
  permissions: [],
};

describe("tlmFetch / backendFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("attaches the bearer token and hits TLM's base URL", async () => {
    setSession("tok123", demoUser);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await tlmFetch<{ ok: boolean }>("/users/me");
    expect(data).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("http://localhost:4000/api/v1/users/me");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("hits tlm-backend's base URL, a different host than tlmFetch", async () => {
    setSession("tok123", demoUser);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await backendFetch("/employees");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("http://localhost:4200/api/v1/employees");
  });

  it("serializes query params, skipping undefined/null/empty values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await backendFetch("/employees", { query: { page: 2, status: undefined, search: "", clientId: null } });

    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.has("status")).toBe(false);
    expect(parsed.searchParams.has("search")).toBe(false);
    expect(parsed.searchParams.has("clientId")).toBe(false);
  });

  it("normalizes the backend's error envelope into an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "BadRequest", message: "nope" }), { status: 400 }))
    );
    await expect(backendFetch("/x")).rejects.toMatchObject({ status: 400, message: "nope", code: "BadRequest" });
  });

  it("clears the session on a 401", async () => {
    setSession("tok", demoUser);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    await expect(backendFetch("/x")).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
  });
});
