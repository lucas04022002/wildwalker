import billingRepository from "../src/modules/shared/billingRepository";

/**
 * Le numéro de facture vient désormais d'un compteur dédié
 * (`invoice_counter`, migration 0002) et non plus d'un `COUNT(*)` sur
 * `booking`. Ce test fige la SÉQUENCE SQL : un upsert qui incrémente sous
 * verrou, puis une lecture dans la même transaction. Inverser les deux, ou
 * retomber sur un COUNT, rend deux fois le même numéro à deux paiements
 * simultanés.
 */

const UPSERT =
  "INSERT INTO invoice_counter (`year`, `last`) VALUES (?, 1) ON DUPLICATE KEY UPDATE `last` = `last` + 1";
const READ = "SELECT `last` FROM invoice_counter WHERE `year` = ?";

/** Connexion mockée : l'upsert ne rend rien, la lecture rend `last`. */
const connectionWith = (last: number) => ({
  query: jest
    .fn()
    .mockResolvedValueOnce([{ affectedRows: 1 }, []])
    .mockResolvedValueOnce([[{ last }], []]),
});

describe("billingRepository.nextBillsNumber", () => {
  test("numérote la première facture de l'année à 1", async () => {
    const connection = connectionWith(1);

    const billsNumber = await billingRepository.nextBillsNumber(
      connection as never,
      2026,
    );

    expect(billsNumber).toBe("2026-1");
  });

  test("la séquence est bien : incrémenter, puis lire", async () => {
    const connection = connectionWith(42);

    await billingRepository.nextBillsNumber(connection as never, 2026);

    expect(connection.query).toHaveBeenCalledTimes(2);
    expect(connection.query).toHaveBeenNthCalledWith(1, UPSERT, [2026]);
    expect(connection.query).toHaveBeenNthCalledWith(2, READ, [2026]);
  });

  test("le numéro rendu est la valeur du compteur, pas un COUNT(*)", async () => {
    const connection = connectionWith(42);

    const billsNumber = await billingRepository.nextBillsNumber(
      connection as never,
      2026,
    );

    expect(billsNumber).toBe("2026-42");
  });

  test("plus aucune lecture de la table booking", async () => {
    const connection = connectionWith(7);

    await billingRepository.nextBillsNumber(connection as never, 2026);

    for (const [sql] of connection.query.mock.calls) {
      expect(String(sql)).not.toMatch(/\bbooking\b/i);
      expect(String(sql)).not.toMatch(/COUNT\(/i);
    }
  });

  test("ne mélange pas les années : le compteur est adressé par année", async () => {
    const connection = connectionWith(4);

    const billsNumber = await billingRepository.nextBillsNumber(
      connection as never,
      2025,
    );

    expect(billsNumber).toBe("2025-4");
    expect(connection.query).toHaveBeenNthCalledWith(1, UPSERT, [2025]);
    expect(connection.query).toHaveBeenNthCalledWith(2, READ, [2025]);
  });
});
