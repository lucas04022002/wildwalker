import { ReceiptText } from "lucide-react";
import { useState } from "react";
import useBillingClient from "../../../hooks/useBillingClient";
import "./BillingClient.css";
import { useSession } from "../../../hooks/useSession";

function BillingClient() {
  const { user } = useSession();
  const billing = useBillingClient(user?.id ?? 0);

  const [showAll, setShowAll] = useState(false);
  const displayedBilling = showAll ? billing : billing.slice(0, 8);

  return (
    <section className="billing-client__container">
      <div className="billing-client__header">
        <h2 className="billing-client__title">
          <ReceiptText
            size={20}
            color="var(--color-primary)"
            aria-hidden="true"
          />
          <caption className="sr-only">Historique des factures</caption>
        </h2>
        {billing.length > 8 && (
          <button
            type="button"
            className="billing-client__toggle"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Réduire" : "Afficher tout"}
          </button>
        )}
      </div>

      {billing.length === 0 ? (
        <p className="billing-client__empty">Aucune facture.</p>
      ) : (
        <div className="billing-client__table-scroll">
          <table className="billing-client__table">
            <thead>
              <tr>
                <th className="billing-client__th" scope="col">
                  Référence
                </th>
                <th className="billing-client__th" scope="col">
                  Date
                </th>
                <th className="billing-client__th" scope="col">
                  Description
                </th>
                <th className="billing-client__th" scope="col">
                  Montant
                </th>
                <th className="billing-client__th" scope="col">
                  Statut
                </th>
                <th className="billing-client__th" scope="col">
                  Facture
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedBilling.map((item) => (
                <tr key={item.id} className="billing-client__tr">
                  <td className="billing-client__td">
                    FAC-{item.bills_number}
                  </td>
                  <td className="billing-client__td">
                    {item.start_date.slice(0, 10)}
                  </td>
                  <td className="billing-client__td">
                    {item.name || item.space_name}
                  </td>
                  <td className="billing-client__td">{item.total_price} €</td>
                  <td className="billing-client__td">
                    <span
                      className={`billing-client__badge billing-client__badge--${item.payment_status}`}
                    >
                      {item.payment_status === "paid" ? "Payé" : "En attente"}
                    </span>{" "}
                  </td>
                  <td className="billing-client__td">
                    <button
                      type="button"
                      className="billing-client__pdf"
                      onClick={() =>
                        window.open(`/invoice/${item.id}`, "_blank")
                      }
                      aria-label={`Télécharger la facture ${item.bills_number} en PDF`}
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default BillingClient;
