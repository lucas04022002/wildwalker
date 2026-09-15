import { useEffect, useState } from "react";

import type { Participants } from "../types/participants";
import { apiList } from "./apiFetch";

function useParticipants() {
  const [participants, setParticipants] = useState<Participants[]>([]);
  useEffect(() => {
    apiList<Participants>("/api/events/participants").then(setParticipants);
  }, []);
  return participants;
}

export default useParticipants;
