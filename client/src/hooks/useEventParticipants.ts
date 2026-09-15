import { useEffect, useState } from "react";
import { apiList } from "./apiFetch";

type EventParticipant = {
  id_activity: number;
  name: string;
  sum_participants: string;
  capacity: number;
};

function useEventParticipants() {
  const [participants, setParticipants] = useState<EventParticipant[]>([]);

  useEffect(() => {
    apiList<EventParticipant>("/api/events/participants").then(setParticipants);
  }, []);

  return participants;
}

export default useEventParticipants;
