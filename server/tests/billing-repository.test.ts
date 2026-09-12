import billingRepository from "../src/modules/shared/billingRepository";

describe("billingRepository.nextBillsNumber", () => {
  test("numérote la première facture de l'année à 1", async () => {
    const pool = { query: jest.fn(async () => [[{ count: 0 }], []]) };

    const billsNumber = await billingRepository.nextBillsNumber(
      pool as never,
      2026,
    );

    expect(billsNumber).toBe("2026-1");
    expect(pool.query).toHaveBeenCalledWith(
      "SELECT COUNT(*) as count FROM booking WHERE bills_number LIKE ?",
      ["2026-%"],
    );
  });

  test("incrémente à partir du nombre de factures déjà émises cette année-là", async () => {
    const pool = { query: jest.fn(async () => [[{ count: 41 }], []]) };

    const billsNumber = await billingRepository.nextBillsNumber(
      pool as never,
      2026,
    );

    expect(billsNumber).toBe("2026-42");
  });

  test("fonctionne aussi bien avec une connexion dédiée (transaction) qu'avec le pool", async () => {
    const connection = { query: jest.fn(async () => [[{ count: 3 }], []]) };

    const billsNumber = await billingRepository.nextBillsNumber(
      connection as never,
      2025,
    );

    expect(billsNumber).toBe("2025-4");
  });

  test("ne mélange pas les années : le motif LIKE est bien préfixé par l'année demandée", async () => {
    const pool = { query: jest.fn(async () => [[{ count: 5 }], []]) };

    await billingRepository.nextBillsNumber(pool as never, 2024);

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ["2024-%"]);
  });
});
