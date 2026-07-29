import { AppState, SyncConfig } from "../../types";
import { db, doc, setDoc } from "../../lib/firebase";

export class SyncService {
  /**
   * Forces direct mirroring of the local AppState snapshot to Google Cloud Firestore database
   */
  public async syncWithCloud(cleanCnpj: string, appState: AppState): Promise<boolean> {
    try {
      const docRef = doc(db, "postos", cleanCnpj);
      await setDoc(docRef, appState);
      return true;
    } catch (e) {
      console.error("SyncService: Failed to synchronize with Firestore.", e);
      return false;
    }
  }

  /**
   * Triggers file download representation as a static backup of current AppState (safety backup)
   */
  public downloadAppStateBackup(state: AppState): void {
    const filename = `backup_posto_adm_${new Date().toISOString().split("T")[0]}.json`;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const syncService = new SyncService();
