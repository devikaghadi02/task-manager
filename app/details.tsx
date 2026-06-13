import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function DetailsScreen() {
  const { id, title, completed, userId } = useLocalSearchParams();
  const [saved, setSaved] = useState(false);

  const saveTask = async () => {
    try {
      const task = { id, title, completed, userId };
      await AsyncStorage.setItem(`task_${id}`, JSON.stringify(task));
      setSaved(true);
    } catch (e) {
      console.log("Error saving task", e);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {completed === "true" ? "✅ Completed" : "⏳ Pending"}
        </Text>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        Task #{id} • User #{userId}
      </Text>

      <TouchableOpacity
        style={[styles.saveButton, saved && styles.savedButton]}
        onPress={saveTask}
      >
        <Text style={styles.saveButtonText}>
          {saved ? "🔖 Saved!" : "Save Task"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: "#6200ee",
    fontWeight: "bold",
  },
  statusBadge: {
    backgroundColor: "#e8f5e9",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    color: "#2e7d32",
    fontWeight: "600",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    lineHeight: 30,
  },
  meta: {
    fontSize: 14,
    color: "#888",
    marginBottom: 32,
  },
  saveButton: {
    backgroundColor: "#6200ee",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  savedButton: {
    backgroundColor: "#2e7d32",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
