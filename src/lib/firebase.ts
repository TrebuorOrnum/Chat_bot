import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, setDoc, getDocFromServer, query, where, getDocs, orderBy, deleteDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test completed.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    } else {
      console.log("Firestore connection test response (expected if unauthenticated/non-existent doc):", error);
    }
  }
}
testConnection();

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Firestore error handler and types
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Firestore helper functions
export const createChatSession = async (userDetails: { name: string; phone: string; email: string }) => {
  const path = "chatSessions";
  try {
    const sessionRef = doc(collection(db, path));
    const sessionId = sessionRef.id;
    
    await setDoc(sessionRef, {
      userDetails,
      createdAt: serverTimestamp(),
      messages: []
    });
    
    return sessionId;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, path);
    return null;
  }
};

export const getChatSession = async (sessionId: string) => {
  const path = `chatSessions/${sessionId}`;
  try {
    const sessionRef = doc(db, "chatSessions", sessionId);
    const docSnap = await getDoc(sessionRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, path);
    return null;
  }
};

export const getUserChatSessions = async (email: string) => {
  const path = "chatSessions";
  try {
    const q = query(
      collection(db, "chatSessions"),
      where("userDetails.email", "==", email),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const sessions: any[] = [];
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return sessions;
  } catch (e) {
    console.warn("Index query failed, falling back to in-memory sort:", e);
    try {
      const q = query(
        collection(db, "chatSessions"),
        where("userDetails.email", "==", email)
      );
      const querySnapshot = await getDocs(q);
      const sessions: any[] = [];
      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      sessions.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      return sessions;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
      return [];
    }
  }
};

export const deleteChatSession = async (sessionId: string) => {
  const path = `chatSessions/${sessionId}`;
  try {
    const sessionRef = doc(db, "chatSessions", sessionId);
    await deleteDoc(sessionRef);
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
};

export const appendMessageToSession = async (sessionId: string, role: string, content: string) => {
  const path = `chatSessions/${sessionId}`;
  try {
    const sessionRef = doc(db, "chatSessions", sessionId);
    await updateDoc(sessionRef, {
      messages: arrayUnion({ role, content, timestamp: new Date().toISOString() })
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, path);
  }
};
