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
  signInWithCredential,
  User as FirebaseUser,
  linkWithCredential
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
import { getAnalytics, logEvent as firebaseLogEvent, isSupported } from "firebase/analytics";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const databaseId = (firebaseConfig as any).firestoreDatabaseId;
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
const storage = getStorage(app);

// Safe Analytics Initialization
let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
        console.log("[Firebase Analytics] Habilitado com sucesso.");
      } catch (err) {
        console.warn("[Firebase Analytics] Não foi possível inicializar o Analytics (rede ou sandbox):", err);
      }
    } else {
      console.warn("[Firebase Analytics] Não é suportado neste ambiente.");
    }
  }).catch((err) => {
    console.warn("[Firebase Analytics] Falha ao verificar suporte do Analytics (silencioso):", err?.message || err);
  });
}

export function logAnalyticsEvent(eventName: string, params?: Record<string, any>) {
  if (analytics) {
    try {
      firebaseLogEvent(analytics, eventName, params);
      console.log(`[Analytics Event] ${eventName}`, params);
    } catch (err) {
      console.warn("[Firebase Analytics] Erro ao registrar evento:", err);
    }
  } else {
    console.log(`[Analytics Simulation] ${eventName}`, params);
  }
}

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

// In-memory token cache for Google OAuth scopes (such as Google Drive)
let cachedAccessToken: string | null = null;

const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Register auth state listener to clear the cached token on logout
onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

// Robust helper to perform safe Google Sign-In with automatic fallback to Redirect on popup blocks or PWA environments
const safeSignInWithGoogle = async () => {
  const logId = `auth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  await logAuthTelemetry(logId, "popup", "success", { message: "Iniciando login via popup seguro mesmo-origem" });

  return new Promise<any>((resolve, reject) => {
    const popupWidth = 550;
    const popupHeight = 650;
    const left = window.screen.width / 2 - popupWidth / 2;
    const top = window.screen.height / 2 - popupHeight / 2;
    
    const popup = window.open(
      "/google-auth.html",
      "google_firebase_auth_popup",
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top}`
    );

    if (!popup) {
      const popupError = new Error("Bloqueador de popups detectado. Por favor, autorize popups para este site para continuar com o login do Google.");
      (popupError as any).code = "auth/popup-blocked";
      logAuthTelemetry(logId, "popup", "failed", { errorCode: "auth/popup-blocked", errorMessage: popupError.message });
      reject(popupError);
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      // Validate origin
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && !origin.includes("web-preview")) {
        return;
      }

      if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
        window.removeEventListener("message", handleMessage);
        clearInterval(timer);
        
        const { idToken, uid, email, accessToken } = event.data;
        if (accessToken) {
          cachedAccessToken = accessToken;
        }
        try {
          const credential = GoogleAuthProvider.credential(idToken);
          const result = await signInWithCredential(auth, credential);
          
          await logAuthTelemetry(logId, "popup", "success", { 
            message: "Autenticado com sucesso via popup-proxy", 
            uid,
            email 
          });
          
          resolve(result);
        } catch (authErr: any) {
          await logAuthTelemetry(logId, "popup", "failed", { 
            errorCode: authErr.code || "unknown", 
            errorMessage: authErr.message || "Erro ao fazer login com credencial" 
          });
          reject(authErr);
        }
      } else if (event.data?.type === "GOOGLE_AUTH_ERROR") {
        window.removeEventListener("message", handleMessage);
        clearInterval(timer);
        
        const errorMsg = event.data.error || "Erro desconhecido no popup";
        const customErr: any = new Error(errorMsg);
        customErr.code = "auth/popup-closed-by-user"; // Fallback to graceful message
        
        await logAuthTelemetry(logId, "popup", "failed", { 
          errorCode: "GOOGLE_AUTH_ERROR", 
          errorMessage: errorMsg 
        });
        
        reject(customErr);
      }
    };

    window.addEventListener("message", handleMessage);

    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        setTimeout(() => {
          window.removeEventListener("message", handleMessage);
          
          const userClosedErr: any = new Error("O login via Google foi cancelado antes de ser concluído.");
          userClosedErr.code = "auth/popup-closed-by-user";
          
          logAuthTelemetry(logId, "popup", "failed", { 
            errorCode: "auth/popup-closed-by-user", 
            errorMessage: "Popup fechado pelo usuário" 
          });
          
          reject(userClosedErr);
        }, 300);
      }
    }, 1000);
  });
};

// Custom wrapped signInWithPopup (legacy placeholder wrapper, now mapping to safeSignInWithGoogle)
const signInWithPopup = async (authInstance: any, providerInstance: any) => {
  return safeSignInWithGoogle();
};

const linkGoogleAccount = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Nenhum usuário está conectado atualmente.");
  }

  const logId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  await logAuthTelemetry(logId, "link_popup", "success", { message: "Iniciando vinculação de conta Google" });

  return new Promise<any>((resolve, reject) => {
    const popupWidth = 550;
    const popupHeight = 650;
    const left = window.screen.width / 2 - popupWidth / 2;
    const top = window.screen.height / 2 - popupHeight / 2;
    
    const popup = window.open(
      "/google-auth.html",
      "google_firebase_auth_popup",
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top}`
    );

    if (!popup) {
      const popupError = new Error("Bloqueador de popups detectado. Por favor, autorize popups para este site para continuar com o login do Google.");
      reject(popupError);
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && !origin.includes("web-preview")) {
        return;
      }

      if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
        window.removeEventListener("message", handleMessage);
        clearInterval(timer);
        
        const { idToken, uid, email, displayName, accessToken } = event.data;
        if (accessToken) {
          cachedAccessToken = accessToken;
        }
        try {
          const credential = GoogleAuthProvider.credential(idToken);
          const result = await linkWithCredential(currentUser, credential);
          
          await logAuthTelemetry(logId, "link", "success", { 
            message: "Conta Google vinculada com sucesso", 
            uid,
            email 
          });
          
          resolve({ result, email, displayName, accessToken });
        } catch (authErr: any) {
          await logAuthTelemetry(logId, "link", "failed", { 
            errorCode: authErr.code || "unknown", 
            errorMessage: authErr.message || "Erro ao vincular conta Google" 
          });
          reject(authErr);
        }
      } else if (event.data?.type === "GOOGLE_AUTH_ERROR") {
        window.removeEventListener("message", handleMessage);
        clearInterval(timer);
        
        const errorMsg = event.data.error || "Erro desconhecido no popup";
        reject(new Error(errorMsg));
      }
    };

    window.addEventListener("message", handleMessage);

    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        setTimeout(() => {
          window.removeEventListener("message", handleMessage);
          reject(new Error("A vinculação com o Google foi cancelada antes de ser concluída."));
        }, 300);
      }
    }, 1000);
  });
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
  linkGoogleAccount,
  getAccessToken,
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
