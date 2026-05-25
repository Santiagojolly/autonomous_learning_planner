import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router";
import { toast } from "sonner";
import { API, STUB_MODE } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => { },
  signUp: async () => { },
  signOut: () => { },
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Register the session-expired callback.
  // Guard: if we're already on /login or /, do nothing (prevents toast+redirect loop).
  useEffect(() => {
    API.onSessionExpired = () => {
      if (STUB_MODE) return; // In stub mode, never trigger expiry UI

      const onAuthPage = location.pathname === "/login" || location.pathname === "/";
      API.setToken(null);
      setUser(null);
      if (!onAuthPage) {
        toast.error("Session expired — please sign in again", { duration: 5000 });
        navigate("/login", { replace: true });
      }
    };
    return () => { API.onSessionExpired = null; };
  }, [navigate, location.pathname]);

  useEffect(() => {
    const checkSession = async () => {
      const token = API.getToken();
      if (!token && !STUB_MODE) {
        setLoading(false);
        return;
      }

      if (STUB_MODE) {
        try {
          const res = await API.getProfile();
          if (res.profile) {
            setUser({
              id: res.profile.id,
              email: res.profile.email,
              name: res.profile.name
            });
          }
        } catch (e) {
          console.error("Stub session restoration failed", e);
        }
        setLoading(false);
        return;
      }

      if (API.isTokenExpired()) {
        API.refreshAccessToken().then((newToken) => {
          if (newToken) {
            fetchUserProfile();
          } else {
            API.setToken(null);
            setLoading(false);
          }
        });
      } else {
        fetchUserProfile();
      }
    };

    checkSession();
  }, []);

  const fetchUserProfile = async () => {
    if (STUB_MODE) return; // Logic handled in useEffect above

    try {
      const data = await API.getProfile();
      if (data.profile) {
        setUser({
          id: data.profile.id || "user",
          email: data.profile.email,
          name: data.profile.name,
        });
      }
    } catch (error: any) {
      console.error("Failed to fetch user profile:", error);
      if (
        error.message?.includes("Session expired") ||
        error.message?.includes("401") ||
        error.message?.includes("Unauthorized")
      ) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await API.signIn(email, password);
      if (result.success && result.session?.access_token && result.user) {
        API.setToken(result.session.access_token, result.session.refresh_token ?? null);
        setUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.user_metadata?.name || email.split("@")[0],
        });
      } else {
        throw new Error(result.error || "Invalid sign in response");
      }
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const result = await API.signUp(email, password, name);
      if (result.success && result.session?.access_token && result.user) {
        API.setToken(result.session.access_token, result.session.refresh_token ?? null);
        setUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.user_metadata?.name || name,
        });
      } else {
        throw new Error(result.error || "Signup failed");
      }
    } catch (error) {
      console.error("Sign up error:", error);
      throw error;
    }
  };

  const signOut = () => {
    API.signOut();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}