import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Language = 'en' | 'nl';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);

  // Load user preference on mount
  useEffect(() => {
    async function loadPreference() {
      if (!user) {
        setLanguageState('en');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('preferred_language')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error loading language preference:', error);
        }

        if (data?.preferred_language) {
          setLanguageState(data.preferred_language as Language);
        }
      } catch (error) {
        console.error('Error loading language preference:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreference();
  }, [user]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);

    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: user.id, preferred_language: lang },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Error saving language preference:', error);
      }
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
