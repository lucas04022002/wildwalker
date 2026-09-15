import { useEffect, useState } from "react";
import type { Activity } from "../types/activity";
import { apiList } from "./apiFetch";

function useEventsOfTheDay(dateFormatted: string | null) {
  const [eventsOfTheDay, setEventsOfTheDay] = useState<Activity[]>([]);

  useEffect(() => {
    if (!dateFormatted) {
      setEventsOfTheDay([]);
      return;
    }

    apiList<Activity>(`/api/events/${dateFormatted}`).then(setEventsOfTheDay);
  }, [dateFormatted]);

  return eventsOfTheDay;
}

export default useEventsOfTheDay;
