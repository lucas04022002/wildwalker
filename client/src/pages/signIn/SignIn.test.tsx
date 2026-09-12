import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignIn from "./SignIn";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Page repère : affiche le message transmis dans `state.notice`. */
function LoginProbe() {
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  return <p data-testid="notice">{notice ?? "aucun message"}</p>;
}

const renderSignIn = () =>
  render(
    <MemoryRouter initialEntries={["/sign-in"]}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/log-in" element={<LoginProbe />} />
        <Route
          path="/dashboard-client"
          element={<p>tableau de bord client</p>}
        />
      </Routes>
    </MemoryRouter>,
  );

const submit = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Email"), "nouveau@lelocal.fr");
  await user.type(screen.getByPlaceholderText("Mot de passe"), "motdepasse");
  await user.click(screen.getByRole("button", { name: /créer mon compte/i }));
};

describe("SignIn", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renvoie vers la connexion avec le message du serveur (201 sans session)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        { message: "Si l'adresse est disponible, le compte est créé." },
        201,
      ),
    );

    renderSignIn();
    await submit();

    expect(await screen.findByTestId("notice")).toHaveTextContent(
      "Si l'adresse est disponible, le compte est créé.",
    );
    // L'inscription n'ouvre pas de session : pas d'accès direct au dashboard.
    expect(
      screen.queryByText("tableau de bord client"),
    ).not.toBeInTheDocument();
  });

  it("n'écrit aucun jeton dans le stockage du navigateur", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: "Compte créé." }, 201),
    );

    renderSignIn();
    await submit();

    await screen.findByTestId("notice");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("affiche l'erreur du serveur et reste sur le formulaire", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: "Champs obligatoires manquants." }, 400),
    );

    renderSignIn();
    await submit();

    expect(
      await screen.findByText("Champs obligatoires manquants."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("notice")).not.toBeInTheDocument();
  });
});
