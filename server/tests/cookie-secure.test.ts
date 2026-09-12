import {
  cookieOptions,
  isCookieSecure,
} from "../src/modules/Authentification/Jwt";

/**
 * L'attribut `Secure` du cookie de session n'est pas une option de confort :
 * sans lui, la session voyage en clair. On vérifie donc que le défaut est
 * fermé en production, et que le levier de la CI n'agit que s'il est posé
 * explicitement.
 *
 * L'environnement est passé en argument plutôt que muté globalement : un test
 * qui oublie de remettre `process.env` en état empoisonne les suivants.
 */
describe("attribut Secure du cookie de session", () => {
  test("sans override, production ⇒ Secure", () => {
    expect(isCookieSecure({ NODE_ENV: "production" })).toBe(true);
  });

  test("sans override, hors production ⇒ pas de Secure", () => {
    expect(isCookieSecure({ NODE_ENV: "development" })).toBe(false);
    expect(isCookieSecure({})).toBe(false);
  });

  test("COOKIE_SECURE=0 désarme Secure même en production (smoke test CI)", () => {
    expect(isCookieSecure({ NODE_ENV: "production", COOKIE_SECURE: "0" })).toBe(
      false,
    );
    expect(
      isCookieSecure({ NODE_ENV: "production", COOKIE_SECURE: "false" }),
    ).toBe(false);
  });

  test("COOKIE_SECURE=1 arme Secure hors production", () => {
    expect(
      isCookieSecure({ NODE_ENV: "development", COOKIE_SECURE: "1" }),
    ).toBe(true);
  });

  test("une valeur inconnue ne désarme rien : le défaut reste celui de NODE_ENV", () => {
    expect(
      isCookieSecure({ NODE_ENV: "production", COOKIE_SECURE: "peut-être" }),
    ).toBe(true);
    expect(isCookieSecure({ NODE_ENV: "production", COOKIE_SECURE: "" })).toBe(
      true,
    );
  });

  test("le cookie posé reste httpOnly, SameSite=Lax et limité à la racine", () => {
    const options = cookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    // La suite des tests tourne avec NODE_ENV=test : pas de Secure ici, et
    // c'est bien la même fonction qui décide.
    expect(options.secure).toBe(isCookieSecure());
  });
});
