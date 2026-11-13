import React, { useContext } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { FriendScheduleScreen } from './src/screens/FriendScheduleScreen';
import { colors } from './src/styles/theme';

// Set to true to close public student access during maintenance / pre-launch
const MAINTENANCE_MODE = false;

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 6 },
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'EUE' }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'My Schedule' }} />
      <Tab.Screen name="Friends" component={FriendsScreen} options={{ title: 'Friends & Social' }} />
    </Tab.Navigator>
  );
}

function NavigationRoot() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="FriendSchedule"
              component={FriendScheduleScreen}
              options={({ navigation }) => ({
                headerShown: true,
                title: "Friend's Schedule",
                headerStyle: { backgroundColor: colors.primary },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '700' },
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs'))}
                    style={{ paddingRight: 12, paddingVertical: 6 }}
                    accessibilityLabel="Go Back"
                  >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>← Back</Text>
                  </TouchableOpacity>
                ),
              })}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function MaintenanceScreen() {
  return (
    <View style={maintenanceStyles.container}>
      <View style={maintenanceStyles.card}>
        <View style={maintenanceStyles.badge}>
          <Text style={maintenanceStyles.badgeText}>🚧 UNDER MAINTENANCE</Text>
        </View>
        <Text style={maintenanceStyles.logo}>EUE</Text>
        <Text style={maintenanceStyles.title}>Schedule Sync</Text>
        <Text style={maintenanceStyles.subtitle}>
          European Universities in Egypt • Official Campus Launch Prep
        </Text>

        <View style={maintenanceStyles.divider} />

        <Text style={maintenanceStyles.body}>
          The site is temporarily closed while we make updates and finalize features before the official launch.
        </Text>

        <Text style={maintenanceStyles.note}>
          Student registration and schedule sync are temporarily paused. Thank you for your patience — we will be live soon! 🚀
        </Text>

        <View style={maintenanceStyles.footer}>
          <Text style={maintenanceStyles.footerText}>
            European Universities in Egypt (UoL • UCLan • UEL)
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  if (MAINTENANCE_MODE) {
    return <MaintenanceScreen />;
  }

  return (
    <AuthProvider>
      <NavigationRoot />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});

const maintenanceStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Deep navy
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 32,
    maxWidth: 480,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  badge: {
    backgroundColor: '#78350f',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginBottom: 20,
  },
  badgeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 4,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#38bdf8', // Light sky blue
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    width: '100%',
    marginVertical: 24,
  },
  body: {
    fontSize: 15,
    color: '#e2e8f0',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 12,
  },
  note: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
});
