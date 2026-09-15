import { useEffect, useState } from "react";
import type { TimeSlot } from "../types/time-slot";
import { apiList } from "./apiFetch";

function useTimeSlot() {
  const [timeSlot, setTimeSlot] = useState<TimeSlot[]>([]);
  useEffect(() => {
    apiList<TimeSlot>("/api/timeslots").then(setTimeSlot);
  }, []);

  return timeSlot;
}

export default useTimeSlot;
