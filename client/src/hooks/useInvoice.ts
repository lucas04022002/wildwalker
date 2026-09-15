import { useEffect, useState } from "react";
import type { BookingHistory } from "../types/booking";
import { apiOne } from "./apiFetch";

function useInvoice(bookingId: number) {
  const [invoice, setInvoice] = useState<BookingHistory | null>(null);

  useEffect(() => {
    apiOne<BookingHistory>(`/api/invoice/${bookingId}`).then(setInvoice);
  }, [bookingId]);

  return invoice;
}

export default useInvoice;
