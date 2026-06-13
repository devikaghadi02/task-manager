import { useRef, useState } from "react";
import { Animated, StyleSheet, TouchableOpacity } from "react-native";

export default function SettingsScreen() {
  const [isDark, setIsDark] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;

  const toggleDarkMode = () => {
    const toValue = isDark ? 0 : 1;
    Animated.timing(animatedValue, {
      toValue,
      duration: 400,
      useNativeDriver: false,
    }).start();
    setIsDark(!isDark);
  };

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#ffffff", "#121212"],
  });

  const textColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#333333", "#ffffff"],
  });

  const toggleBackground = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#ddd", "#6200ee"],
  });

  const knobPosition = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      <Animated.Text style={[styles.title, { color: textColor }]}>
        ⚙️ Settings
      </Animated.Text>

      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? "#1e1e1e" : "#f5f5f5",
          },
        ]}
      >
        <Animated.Text style={[styles.settingLabel, { color: textColor }]}>
          🌙 Dark Mode
        </Animated.Text>

        <TouchableOpacity onPress={toggleDarkMode}>
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
      </Animated.View>

      <Animated.Text style={[styles.hint, { color: textColor }]}>
        {isDark ? "🌙 Dark mode is on" : "☀️ Light mode is on"}
      </Animated.Text>
    </Animated.View>
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
    fontSize: 18,
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
  },
});
