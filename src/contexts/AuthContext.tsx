import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "global_admin" | "group_admin" | "member";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    extra?: Record<string, string>,
    redirectTo?: string
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshRoles: () => Promise<AppRole[]>;
  hasRole: (role: AppRole) => boolean;
  isGroupAdmin: boolean;
  isGlobalAdmin: boolean;
  isMember: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data);
  }, []);

  const fetchRoles = useCallback(async (userId: string): Promise<AppRole[]> => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const r = (data || []).map((row) => row.role as AppRole);
    setRoles(r);
    return r;
  }, []);

  const loadUserData = useCallback(
    async (userId: string) => {
      await Promise.all([fetchProfile(userId), fetchRoles(userId)]);
    },
    [fetchProfile, fetchRoles]
  );

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      userIdRef.current = s?.user?.id ?? null;
      if (s?.user) await loadUserData(s.user.id);
      if (active) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      const newId = s?.user?.id ?? null;
      const changed = newId !== userIdRef.current;
      userIdRef.current = newId;

      if (!s?.user) {
        setProfile(null);
        setRoles([]);
        setLoading(false);
        return;
      }
      if (!changed) return;
      // Defer Supabase calls out of the callback to avoid the auth deadlock
      setLoading(true);
      const uid = s.user.id;
      setTimeout(() => {
        loadUserData(uid).finally(() => {
          if (active) setLoading(false);
        });
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const refreshRoles = useCallback(async (): Promise<AppRole[]> => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setRoles([]);
      return [];
    }
    return fetchRoles(data.user.id);
  }, [fetchRoles]);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    extra?: Record<string, string>,
    redirectTo?: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo ?? `${window.location.origin}/login`,
        data: { ...(extra || {}), full_name: fullName },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    return { error: error as Error | null };
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        refreshRoles,
        hasRole,
        isGlobalAdmin: hasRole("global_admin"),
        isGroupAdmin: hasRole("group_admin"),
        isMember: hasRole("member"),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
