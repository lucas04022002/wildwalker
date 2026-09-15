import { useEffect, useState } from "react";
import type { Activity } from "../types/activity";
import { apiList } from "./apiFetch";

function useUpcomingEvents(refreshKey = 0) {
  const [upcomingEvents, setUpcomingEvents] = useState<Activity[]>([]);

  useEffect(() => {
    void refreshKey;

    apiList<Activity>("/api/events/").then(setUpcomingEvents);
  }, [refreshKey]);

  return upcomingEvents;
}

export default useUpcomingEvents;
