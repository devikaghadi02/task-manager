import { Slot } from "expo-router";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// expo-notifications logs a noisy error on import when running in Expo Go
// (SDK 53+), because it tries to register a remote push token listener
// that Expo Go on Android no longer supports. Local scheduled notifications
// are unaffected and still work fine — this is just suppressing the
// cosmetic red error screen, not disabling any real functionality.
// Must run before the notifications import below, since the warning fires
// at module-load time.
LogBox.ignoreLogs(["expo-notifications: Android Push notifications"]);

import { ThemeProvider } from "../lib/ThemeContext";
import { registerForNotifications } from "../lib/notifications";

export default function RootLayout() {
  useEffect(() => {
    registerForNotifications();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Slot />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
