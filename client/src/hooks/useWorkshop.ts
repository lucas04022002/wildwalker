import { useEffect, useState } from "react";
import type { Space } from "../types/space";
import { apiList } from "./apiFetch";

function useWorkshop() {
  const [workshop, setWorkshop] = useState<Space[]>([]);
  useEffect(() => {
    apiList<Space>("/api/spaces?category=Atelier").then(setWorkshop);
  }, []);

  return workshop;
}

export default useWorkshop;
