import { useEffect, useState } from "react";
import { apiList } from "./apiFetch";

type AdminNotification = {
  id: number;
  title: string;
  detail: string;
  variant: "warning";
};

function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  useEffect(() => {
    apiList<AdminNotification>("/api/dashboard/admin/claims").then(
      setNotifications,
    );
  }, []);

  return notifications;
}

export default useAdminNotifications;
