import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

type SavedTask = {
  id: number;
  task_id: string;
  title: string;
  completed: string;
  task_user_id: string;
  user_id: string;
};

export default function SavedScreen() {
  const [savedTasks, setSavedTasks] = useState<SavedTask[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadSavedTasks();
    }, []),
  );

  const loadSavedTasks = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const admin = user.email === "admin@test.com";
    setIsAdmin(admin);

    let query = supabase.from("saved_tasks").select("*");

    if (!admin) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;
    if (!error && data) {
      setSavedTasks(data);
    }
    setLoading(false);
  };

  const deleteTask = async (taskId: string, userId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (isAdmin) {
      await supabase
        .from("saved_tasks")
        .delete()
        .eq("task_id", taskId)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("saved_tasks")
        .delete()
        .eq("task_id", taskId)
        .eq("user_id", user.id);
    }
    loadSavedTasks();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (savedTasks.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No saved tasks yet!</Text>
        <Text style={styles.emptySubtext}>
          {isAdmin
            ? "No users have saved any tasks"
            : "Go to Home and save some tasks"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved Tasks</Text>
        <View style={[isAdmin ? styles.adminBadge : styles.userBadge]}>
          <Text
            style={[isAdmin ? styles.adminBadgeText : styles.userBadgeText]}
          >
            {isAdmin ? "Admin" : "User"}
          </Text>
        </View>
      </View>

      {isAdmin && (
        <Text style={styles.subtitle}>
          All users saved tasks ({savedTasks.length})
        </Text>
      )}

      <FlatList
        data={savedTasks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View
                style={[
                  styles.statusDot,
                  item.completed === "true"
                    ? styles.dotCompleted
                    : styles.dotPending,
                ]}
              />
              <View style={styles.cardText}>
                <Text style={styles.taskTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.taskMeta}>
                  Task #{item.task_id} • User #{item.task_user_id}
                  {isAdmin ? ` • Saved by ${item.user_id.slice(0, 8)}...` : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteTask(item.task_id, item.user_id)}
              >
                <Text style={styles.delete}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 13,
    color: "#888",
    marginBottom: 16,
  },
  adminBadge: {
    backgroundColor: "#fff3e0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  adminBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e65100",
  },
  userBadge: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  userBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2e7d32",
  },
  loadingText: {
    fontSize: 16,
    color: "#888",
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  dotCompleted: {
    backgroundColor: "#2e7d32",
  },
  dotPending: {
    backgroundColor: "#f9a825",
  },
  cardText: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  taskMeta: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  delete: {
    fontSize: 13,
    color: "#c62828",
    fontWeight: "600",
    marginLeft: 8,
  },
});
