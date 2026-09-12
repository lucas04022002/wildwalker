import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModalEventProvider } from "../../context/CloseEventModalContext";
import type { Session, SessionUser } from "../../hooks/useSession";
import CardEvent from "./CardEvent";

const useSessionMock = vi.hoisted(() => vi.fn<() => Session>());

vi.mock("../../hooks/useSession", () => ({ useSession: useSessionMock }));
vi.mock("../RegisterEventForm/RegisterEventForm", () => ({
  default: () => <p>formulaire d'inscription</p>,
}));

const client: SessionUser = {
  id: 7,
  email: "client@lelocal.fr",
  role: "client",
  firstname: "Chloé",
};

const session = (user: SessionUser | null, loading = false): Session => ({
  user,
  loading,
  refresh: vi.fn(async () => {}),
});

const event = {
  id: 4,
  name: "Atelier poterie",
  description: "Deux heures de tour",
  space_name: "Le Studio",
  url_image: "/uploads/poterie.png",
  price_unit: 20,
  start_date: "2026-10-01T00:00:00.000Z",
  start_hour: "9:00",
  end_hour: "12:00",
  capacity: 10,
  creator_id: 99,
};

const participants = {
  id_activity: 4,
  name: "Atelier poterie",
  sum_participants: 2,
  remaining_slots: 8,
  capacity: 10,
};

const renderCard = () =>
  render(
    <ModalEventProvider>
      <CardEvent event={event} participants={participants} />
    </ModalEventProvider>,
  );

const clickRegister = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /s'inscrire/i }));
};

describe("CardEvent", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
  });

  it("ne réclame pas de connexion tant que la session est inconnue", async () => {
    useSessionMock.mockReturnValue(session(null, true));

    renderCard();
    await clickRegister();

    expect(
      screen.queryByText("Veuillez vous connecter pour vous inscrire"),
    ).not.toBeInTheDocument();
  });

  it("réclame la connexion à un visiteur anonyme qui tente de s'inscrire", async () => {
    useSessionMock.mockReturnValue(session(null));

    renderCard();
    await clickRegister();

    expect(
      await screen.findByText("Veuillez vous connecter pour vous inscrire"),
    ).toBeInTheDocument();
  });

  it("ouvre le formulaire pour un utilisateur connecté", async () => {
    useSessionMock.mockReturnValue(session(client));

    renderCard();
    await clickRegister();

    expect(
      await screen.findByText("formulaire d'inscription"),
    ).toBeInTheDocument();
  });
});
