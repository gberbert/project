import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User as FirebaseUser,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { AppUser } from '../types/auth';

interface AuthContextType {
    user: AppUser | null;
    firebaseUser: FirebaseUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, pass: string) => Promise<void>;
    signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
    logout: () => Promise<void>;
    isAdmin: boolean;
    approveUser: (uid: string, isApproved: boolean) => Promise<void>;
    toggleAI: (uid: string, canUse: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);

    const createUserDoc = async (fbUser: FirebaseUser, name?: string) => {
        const userRef = doc(db, 'users', fbUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            setUser(userSnap.data() as AppUser);
        } else {
            const newUser: AppUser = {
                uid: fbUser.uid,
                email: fbUser.email || '',
                displayName: name || fbUser.displayName || 'User',
                role: 'user',
                isApproved: false,
                canUseAI: false,
                photoURL: fbUser.photoURL || '',
                createdAt: new Date()
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            try {
                setFirebaseUser(fbUser);
                if (fbUser) {
                    // Ensure document exists
                    await createUserDoc(fbUser);
                    // After creating/fetching, verify existing data again to ensure 'user' state is correct if just created
                    const userRef = doc(db, 'users', fbUser.uid);
                    const snap = await getDoc(userRef);
                    if (snap.exists()) setUser(snap.data() as AppUser);

                } else {
                    setUser(null);
                }
            } catch (err) {
                console.error("Auth Initialization Error:", err);
                // Fallback: If we can't read the user profile due to permissions, 
                // we might want to logout or set a minimal user to avoid white screen.
                // For now, let's allow the app to render, user will be null or partial.
                if (fbUser) {
                    // Try to set minimal user from Auth object if DB fails
                    setUser({
                        uid: fbUser.uid,
                        email: fbUser.email || '',
                        displayName: fbUser.displayName || 'User',
                        role: 'user',
                        isApproved: false,
                        canUseAI: false,
                        photoURL: fbUser.photoURL || '',
                        createdAt: new Date()
                    });
                } else {
                    setUser(null);
                }
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    };

    const signInWithEmail = async (email: string, pass: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            console.error("Email login failed", error);
            throw error;
        }
    };

    const signUpWithEmail = async (email: string, pass: string, name: string) => {
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            // Document creation is handled by onAuthStateChanged, but we can pass name via side channel or just update it
            // Wait, onAuthStateChanged runs after this.
            // Better to handle doc creation here to ensure name is correct?
            // Actually, onAuthStateChanged uses displayName. We should update displayName profile.
            // But let's just write the doc directly here to be sure.
            const newUser: AppUser = {
                uid: cred.user.uid,
                email: email,
                displayName: name,
                role: 'user',
                isApproved: false,
                photoURL: '',
                createdAt: new Date()
            };
            await setDoc(doc(db, 'users', cred.user.uid), newUser);
            setUser(newUser);
        } catch (error) {
            console.error("Signup failed", error);
            throw error;
        }
    };

    const logout = () => signOut(auth);

    const approveUser = async (uid: string, isApproved: boolean) => {
        if (user?.role !== 'master') return;
        await updateDoc(doc(db, 'users', uid), { isApproved });
    };

    // Global Script
    useEffect(() => {
        (window as any).setMaster = async (email: string) => {
            // ... (keep existing script logic if needed, or refine)
            const { collection, getDocs, query, where, writeBatch } = await import('firebase/firestore');
            const q = query(collection(db, 'users'), where('email', '==', email));
            const snap = await getDocs(q);
            if (snap.empty) { console.warn("User not found: " + email); return; }
            const batch = writeBatch(db);
            snap.docs.forEach(d => { batch.update(d.ref, { role: 'master', isApproved: true }); });
            await batch.commit();
            console.log(`User ${email} is now MASTER!`);
            if (user?.email === email) window.location.reload();
        };
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user,
            firebaseUser,
            loading,
            signInWithGoogle,
            signInWithEmail,
            signUpWithEmail,
            logout,
            isAdmin: user?.role === 'master',
            approveUser,
            toggleAI: async (uid: string, canUse: boolean) => {
                if (user?.role !== 'master') return;
                await updateDoc(doc(db, 'users', uid), { canUseAI: canUse });
            }
        }}>
            {children}
        </AuthContext.Provider>
    );
};
