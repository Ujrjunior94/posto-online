import { useState, useEffect, useCallback } from "react";
import { AppState } from "../../types";
import { syncService } from "../services/sync.service";

export function useOffline() {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const syncToCloud = useCallback(async (cnpj: string, state: AppState) => {
    return syncService.syncWithCloud(cnpj, state);
  }, []);

  const downloadBackup = useCallback((state: AppState) => {
    syncService.downloadAppStateBackup(state);
  }, []);

  return {
    isOnline,
    syncToCloud,
    downloadBackup,
  };
}
