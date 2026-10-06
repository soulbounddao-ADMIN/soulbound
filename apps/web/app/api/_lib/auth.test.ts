import { bearerTokenFromRequest, resolveActor, resolveUserContext } from "./auth";

describe("auth helpers", () => {
  it("extracts bearer tokens", () => {
    const request = new Request("http://localhost/api", {
      headers: {
        authorization: "Bearer access-token",
      },
    });

    expect(bearerTokenFromRequest(request)).toBe("access-token");
  });

  it("rejects missing or malformed bearer tokens without reading env", async () => {
    expect(bearerTokenFromRequest(new Request("http://localhost/api")))
      .toBeNull();
    expect(bearerTokenFromRequest(new Request("http://localhost/api", {
      headers: {
        authorization: "Basic abc",
      },
    }))).toBeNull();
    await expect(resolveActor(new Request("http://localhost/api")))
      .resolves.toBeNull();
    await expect(resolveUserContext(new Request("http://localhost/api")))
      .resolves.toBeNull();
  });
});
