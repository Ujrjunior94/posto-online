import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup as firebaseSignInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getFirestore, 
  enableIndexedDbPersistence,
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  getDocs,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const databaseId = (firebaseConfig as any).firestoreDatabaseId;
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
const storage = getStorage(app);

if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn("Firestore: Persistência desativada (múltiplas abas abertas)");
    } else if (err.code === "unimplemented") {
      // The current browser does not support all of the features required to enable persistence
      console.warn("Firestore: Navegador não suporta persistência offline completa");
    } else {
      console.warn("Firestore: Persistência offline não habilitada:", err?.message || err);
    }
  });
}

// Core telemetry tracking helper for Google Auth fallback monitoring
const logAuthTelemetry = async (logId: string, stage: string, status: "success" | "pending_redirect" | "failed", details?: any) => {
  const timestamp = new Date().toISOString();
  const payload = {
    timestamp,
    stage, // 'popup' | 'redirect_fallback' | 'redirect_result'
    status,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    url: typeof window !== "undefined" ? window.location.href : "",
    ...details
  };
  try {
    // Save to Firestore under 'auth_telemetry'
    await setDoc(doc(db, "auth_telemetry", logId), payload, { merge: true });
    
    // Maintain structured stats in localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      const statsStr = localStorage.getItem("google_auth_stats");
      const stats = statsStr ? JSON.parse(statsStr) : { attempts: 0, popupSuccess: 0, fallbackSuccess: 0, failures: 0 };
      
      stats.attempts++;
      if (status === "success") {
        if (stage === "popup") {
          stats.popupSuccess++;
        } else if (stage === "redirect_result") {
          stats.fallbackSuccess++;
        }
      } else if (status === "failed") {
        stats.failures++;
      }
      
      localStorage.setItem("google_auth_stats", JSON.stringify(stats));
    }
    
    console.log(`[GoogleAuthTelemetry] ${stage.toUpperCase()} - ${status.toUpperCase()}:`, payload);
  } catch (err) {
    console.error("[GoogleAuthTelemetry] Falha ao registrar telemetria:", err);
  }
};

// Robust helper to perform safe Google Sign-In with automatic fallback to Redirect on popup blocks or PWA environments
const safeSignInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  
  const logId = `auth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    await logAuthTelemetry(logId, "popup", "success", { message: "Iniciando login via popup Google" });
    const result = await firebaseSignInWithPopup(auth, provider);
    await logAuthTelemetry(logId, "popup", "success", { 
      message: "Autenticado via popup Google com sucesso", 
      uid: result.user?.uid,
      email: result.user?.email 
    });
    return result;
  } catch (error: any) {
    console.warn("signInWithPopup falhou, avaliando fallback para signInWithRedirect:", error);
    
    const isUserCancelled = error.code === "auth/popup-closed-by-user" || error.message?.includes("closed");
    const isBlockedOrRestricted = 
      error.code === "auth/popup-blocked" || 
      error.code === "auth/operation-not-supported" ||
      error.code === "auth/iframe-user-cancelled" ||
      error.code === "auth/network-request-failed" ||
      /blocked|restricted|iframe|sandbox|network/i.test(error.message || "") ||
      /popup/i.test(error.code || "");

    const isMobile = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator?.userAgent || ""
    );

    await logAuthTelemetry(logId, "popup", "failed", { 
      errorCode: error.code, 
      errorMessage: error.message,
      isUserCancelled,
      isBlockedOrRestricted,
      isMobile
    });

    if (isBlockedOrRestricted || isMobile || !isUserCancelled) {
      console.log("Iniciando redirect como fallback robusto...");
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem("pending_auth_log_id", logId);
        }
        await logAuthTelemetry(logId, "redirect_fallback", "pending_redirect", { 
          message: "Redirecionando usuário para Google Auth" 
        });
        await signInWithRedirect(auth, provider);
        return null;
      } catch (redirectErr: any) {
        await logAuthTelemetry(logId, "redirect_fallback", "failed", { 
          errorCode: redirectErr.code, 
          errorMessage: redirectErr.message 
        });
        console.error("signInWithRedirect falhou:", redirectErr);
        throw redirectErr;
      }
    }
    
    throw error;
  }
};

// Custom wrapped signInWithPopup with automatic fallback to signInWithRedirect (legacy placeholder wrapper)
const signInWithPopup = async (authInstance: any, providerInstance: any) => {
  try {
    return await firebaseSignInWithPopup(authInstance, providerInstance);
  } catch (error: any) {
    console.warn("signInWithPopup falhou, tentando fallback com signInWithRedirect:", error);

    const isUserCancelled = error.code === "auth/popup-closed-by-user" || error.message?.includes("closed");
    const isBlockedOrRestricted = 
      error.code === "auth/popup-blocked" || 
      error.code === "auth/operation-not-supported" ||
      error.code === "auth/iframe-user-cancelled" ||
      /blocked|restricted|iframe|sandbox/i.test(error.message || "") ||
      /popup/i.test(error.code || "");

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator?.userAgent || ""
    );

    if (isBlockedOrRestricted || isMobile || !isUserCancelled) {
      console.log("Ambiente restrito ou erro de popup detectado. Iniciando redirecionamento...");
      try {
        await signInWithRedirect(authInstance, providerInstance);
        return null;
      } catch (redirectErr) {
        console.error("signInWithRedirect falhou também:", redirectErr);
        throw error;
      }
    }
    
    throw error;
  }
};

export { 
  app, 
  auth, 
  db, 
  storage,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  safeSignInWithGoogle,
  logAuthTelemetry,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  ref,
  uploadBytes,
  getDownloadURL,
  type FirebaseUser
};
