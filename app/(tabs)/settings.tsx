import { router } from "expo-router";
import { useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/ThemeContext";

export default function SettingsScreen() {
  const { isDark, toggleDark, colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  const handleToggle = () => {
    const toValue = isDark ? 0 : 1;
    Animated.timing(animatedValue, {
      toValue,
      duration: 400,
      useNativeDriver: false,
    }).start();
    toggleDark();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const toggleBackground = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#ddd", "#6200ee"],
  });

  const knobPosition = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => router.push("/profile")}
      >
        <Text style={[styles.settingLabel, { color: colors.text }]}>
          Profile
        </Text>
        <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
      </TouchableOpacity>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>
          Dark Mode
        </Text>
        <TouchableOpacity onPress={handleToggle}>
          <Animated.View
            style={[styles.toggle, { backgroundColor: toggleBackground }]}
          >
            <Animated.View
              style={[
                styles.knob,
                { transform: [{ translateX: knobPosition }] },
              ]}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <Text style={[styles.hint, { color: colors.subtext }]}>
        {isDark ? "Dark mode is on" : "Light mode is on"}
      </Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 32,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  chevron: {
    fontSize: 22,
    fontWeight: "600",
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    padding: 2,
  },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  hint: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: "#ffebee",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  logoutText: {
    color: "#c62828",
    fontSize: 16,
    fontWeight: "bold",
  },
});
