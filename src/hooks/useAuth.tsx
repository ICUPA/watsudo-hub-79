import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

export interface Profile {
  id: string;
  user_id: string;
  wa_phone: string;
  wa_name?: string;
  locale: string;
  role: 'user' | 'admin' | 'driver';
  default_momo_phone?: string;
  default_momo_code?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
  isAdmin: boolean;
  isDriver: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'admin';
  const isDriver = profile?.role === 'driver';

  // Enhanced profile loading with better error handling
  const loadProfile = async (userId: string, retryCount = 0): Promise<Profile | null> => {
    try {
      console.log(`Loading profile for user ${userId}, attempt ${retryCount + 1}`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        throw error;
      }

      if (!data && retryCount === 0) {
        // Try to create profile if it doesn't exist
        console.log('Profile not found, attempting to create...');
        const created = await createMissingProfile(userId);
        if (created) {
          return loadProfile(userId, 1);
        }
      }

      console.log('Profile loaded:', data);
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Error loading profile:', error);
      if (retryCount === 0) {
        // Retry once with profile creation
        return loadProfile(userId, 1);
      }
      setProfile(null);
      return null;
    }
  };

  // Improved profile creation with duplicate handling
  const createMissingProfile = async (userId: string): Promise<boolean> => {
    try {
      console.log('Creating missing profile for user:', userId);
      
      // Get user data from auth
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser.user || authUser.user.id !== userId) {
        console.error('Cannot get auth user data:', authError);
        return false;
      }

      const userData = authUser.user;
      const metadata = userData.user_metadata || {};
      
      // Generate a unique phone number or use email as fallback
      let waPhone = metadata.phone || userData.phone || '';
      
      // If no phone, use email prefix with a timestamp to ensure uniqueness
      if (!waPhone) {
        const emailPrefix = userData.email?.split('@')[0] || 'user';
        waPhone = `+${emailPrefix}${Date.now()}`;
      }
      
      // Ensure the phone number is unique by checking existing profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('wa_phone')
        .eq('wa_phone', waPhone)
        .maybeSingle();
      
      // If phone already exists, make it unique
      if (existingProfile) {
        waPhone = `${waPhone}_${userId.slice(0, 8)}`;
      }
      
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          wa_phone: waPhone,
          wa_name: metadata.full_name || metadata.name || userData.email?.split('@')[0] || 'User',
          role: (metadata.role as 'user' | 'admin' | 'driver') || 'user',
          locale: 'en'
        });

      if (error) {
        console.error('Error creating profile:', error);
        // If it's still a duplicate key error, try one more time with a different approach
        if (error.message.includes('duplicate key')) {
          console.log('Duplicate key error, trying with user ID as phone');
          const { error: retryError } = await supabase
            .from('profiles')
            .insert({
              user_id: userId,
              wa_phone: `+user_${userId.replace(/-/g, '').slice(0, 12)}`,
              wa_name: metadata.full_name || metadata.name || userData.email?.split('@')[0] || 'User',
              role: (metadata.role as 'user' | 'admin' | 'driver') || 'user',
              locale: 'en'
            });
          
          if (retryError) {
            console.error('Retry error creating profile:', retryError);
            return false;
          }
        } else {
          return false;
        }
      }

      console.log('Profile created successfully');
      return true;
    } catch (error) {
      console.error('Error creating missing profile:', error);
      return false;
    }
  };

  // Enhanced profile refresh
  const refreshProfile = async (): Promise<void> => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  };

  // Enhanced profile update with validation
  const updateProfile = async (updates: Partial<Profile>): Promise<boolean> => {
    if (!user?.id || !profile) {
      toast.error('User not authenticated');
      return false;
    }

    // Validate required fields
    const updatedData = { ...profile, ...updates };
    
    try {
      console.log('Updating profile with data:', updates);
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        toast.error('Failed to update profile');
        return false;
      }

      // Update local state
      setProfile(updatedData);
      toast.success('Profile updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
      return false;
    }
  };

  // Enhanced sign out with proper cleanup
  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Clear local state first
      setUser(null);
      setSession(null);
      setProfile(null);
      
      // Clear any stored auth data
      localStorage.removeItem('supabase.auth.token');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('Error signing out:', error);
        toast.error('Error signing out');
      } else {
        toast.success('Signed out successfully');
      }
      
      // Force page reload for clean state
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error signing out');
    } finally {
      setLoading(false);
    }
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          return;
        }

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Load profile with retry mechanism
            setTimeout(async () => {
              if (mounted) {
                await loadProfile(session.user.id);
              }
            }, 100);
          }
          
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Load profile on sign in
            setTimeout(async () => {
              if (mounted) {
                await loadProfile(session.user.id);
              }
            }, 100);
          } else {
            // Clear profile on sign out
            setProfile(null);
          }
          
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    profile,
    loading,
    signOut,
    refreshProfile,
    updateProfile,
    isAdmin,
    isDriver,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
