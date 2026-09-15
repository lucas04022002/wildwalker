import { useEffect, useState } from "react";
import type { Space } from "../types/space";
import { apiList } from "./apiFetch";

function useSpaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  useEffect(() => {
    apiList<Space>("/api/spaces").then(setSpaces);
  }, []);
  return spaces;
}

export default useSpaces;
