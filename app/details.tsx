import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function DetailsScreen() {
  const { id, title, completed, userId } = useLocalSearchParams();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkIfSaved();
  }, []);

  const checkIfSaved = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("saved_tasks")
        .select("id")
        .eq("user_id", user.id)
        .eq("task_id", String(id))
        .single();

      if (data) setSaved(true);
    } catch (e) {
      console.log("checkIfSaved error:", e);
    }
  };

  const saveTask = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.log("No user found");
        setLoading(false);
        return;
      }

      console.log("Saving task for user:", user.id);

      const { data, error } = await supabase.from("saved_tasks").insert({
        user_id: user.id,
        task_id: String(id),
        title: String(title),
        completed: String(completed),
        task_user_id: String(userId),
      });

      console.log("Insert result:", data, error);

      if (error) {
        console.log("Error saving:", error.message);
      } else {
        setSaved(true);
      }
    } catch (e) {
      console.log("Exception:", e);
    }
    setLoading(false);
  };

  const unsaveTask = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("saved_tasks")
        .delete()
        .eq("user_id", user.id)
        .eq("task_id", String(id));

      setSaved(false);
    } catch (e) {
      console.log("unsaveTask error:", e);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {completed === "true" ? "Completed" : "Pending"}
        </Text>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        Task #{id} • User #{userId}
      </Text>

      <TouchableOpacity
        style={[styles.saveButton, saved && styles.savedButton]}
        onPress={saved ? unsaveTask : saveTask}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>
          {loading ? "Please wait..." : saved ? "Unsave Task" : "Save Task"}
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
    backgroundColor: "#c62828",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
