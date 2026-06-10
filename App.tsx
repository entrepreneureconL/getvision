import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { supabase } from './src/lib/supabase';
import { businessesRepo } from './src/repos/businesses';
import type { Business } from './src/schemas/business';
import ErrorBoundary from './src/components/ErrorBoundary';
import ConfirmProvider from './src/components/ConfirmProvider';
import WelcomeScreen    from './src/screens/WelcomeScreen';
import LoginScreen      from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import DashboardScreen  from './src/screens/DashboardScreen';
import SettingsScreen   from './src/screens/SettingScreen';
import HistoryScreen    from './src/screens/HistoryScreen';
import type { HistoryFilter } from './src/utils/historyFilters';

type Screen = 'welcome' | 'login' | 'onboarding' | 'dashboard' | 'settings' | 'history';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [loading, setLoading]             = useState(true);
  const [businessId, setBusinessId]       = useState('');
  const [business, setBusiness]           = useState<Business | null>(null);
  const [showConfirmed, setShowConfirmed] = useState(false);
  // F1-M.4 — filtro activo cuando currentScreen='history'. null en cualquier otra pantalla.
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter | null>(null);

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    try {
      // OAuth web (PKCE, fix 2026-06-10): al volver de Google la URL trae
      // `?code=` y el cliente supabase lo canjea solo durante la inicialización
      // (detectSessionInUrl: true). getSession() espera ese canje, así que acá
      // ya tenemos la sesión establecida. El strip manual del hash con
      // access_token (flujo implicit viejo) ya no es necesario.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await resolveScreen(session.user.id);
    } catch (e) {
      console.error('[App] checkSession error:', e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resuelve a qué pantalla mandar al usuario según el estado del negocio.
   * Antes hablaba directo con supabase. Ahora usa businessesRepo (validación
   * zod + manejo de errores + maybeSingle internos).
   */
  const resolveScreen = async (userId: string) => {
    const biz = await businessesRepo.ensureForUser(userId);
    if (biz) {
      setBusinessId(biz.id);
      setBusiness(biz);
      setCurrentScreen(biz.onboarding_completed ? 'dashboard' : 'onboarding');
    } else {
      // ensureForUser devolvió null → algo falló. Volver a welcome es safe.
      console.warn('[App] resolveScreen: no se pudo obtener/crear business');
      setCurrentScreen('welcome');
    }
  };

  const handleLoginSuccess = async () => {
    setShowConfirmed(true);
    setTimeout(() => setShowConfirmed(false), 3000);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await resolveScreen(user.id);
  };

  const handleOnboardingComplete = () => setCurrentScreen('dashboard');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setBusinessId('');
    setBusiness(null);
    setCurrentScreen('welcome');
  };

  // Cuando el usuario guarda en Settings, recargamos el business desde el repo
  // (fuente de verdad). Esto es más robusto que recibir el objeto por callback.
  const handleSettingsSaved = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await resolveScreen(user.id);
    } else {
      setCurrentScreen('dashboard');
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, _session) => {
        if (event === 'SIGNED_OUT') {
          setCurrentScreen('welcome');
          setBusinessId('');
          setBusiness(null);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F1A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2E86C1" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ConfirmProvider>
      <StatusBar style="light" />

      {currentScreen === 'welcome' && (
        <WelcomeScreen onStart={() => setCurrentScreen('login')} />
      )}
      {currentScreen === 'login' && (
        <LoginScreen
          onBack={() => setCurrentScreen('welcome')}
          onSuccess={handleLoginSuccess}
        />
      )}
      {currentScreen === 'onboarding' && businessId.length > 0 && (
        <OnboardingScreen
          businessId={businessId}
          onComplete={handleOnboardingComplete}
        />
      )}
      {currentScreen === 'dashboard' && (
        <DashboardScreen
          onSignOut={handleSignOut}
          onOpenSettings={() => setCurrentScreen('settings')}
          onOpenHistory={(filter) => {
            setHistoryFilter(filter);
            setCurrentScreen('history');
          }}
        />
      )}
      {currentScreen === 'settings' && businessId.length > 0 && (
        <SettingsScreen
          businessId={businessId}
          onBack={() => setCurrentScreen('dashboard')}
          onSaved={handleSettingsSaved}
        />
      )}
      {currentScreen === 'history' && businessId.length > 0 && historyFilter && (
        <HistoryScreen
          businessId={businessId}
          initialFilter={historyFilter}
          onBack={() => {
            setHistoryFilter(null);
            setCurrentScreen('dashboard');
          }}
        />
      )}

      {/* Toast de bienvenida */}
      {showConfirmed && (
        <View style={{
          position: 'absolute', top: 20, left: 20, right: 20, zIndex: 999,
          backgroundColor: '#0D2B1A', borderRadius: 12,
          borderWidth: 1, borderColor: '#1A6B3A',
          padding: 16, flexDirection: 'row',
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>✅</Text>
            <View>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>
                ¡Bienvenido a GetVision!
              </Text>
              <Text style={{ color: '#7F8C8D', fontSize: 12 }}>
                Configuremos tu negocio.
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowConfirmed(false)}>
            <Text style={{ color: '#7F8C8D', fontSize: 18, paddingLeft: 8 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      </ConfirmProvider>
    </ErrorBoundary>
  );
}
