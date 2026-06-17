import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/ThemeContext";

type Task = {
  id: string;
  title: string;
  completed: boolean;
  user_id: string;
  due_date: string | null;
  priority: string;
  category: string | null;
};

export default function SavedScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();

  useFocusEffect(
    useCallback(() => {
      loadCompletedTasks();
    }, []),
  );

  const loadCompletedTasks = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const admin = user.email === "admin@test.com";
      setIsAdmin(admin);

      let query = supabase.from("tasks").select("*").eq("completed", true);

      if (!admin) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (!error && data) {
        setTasks(data as Task[]);
      }
    } catch (e) {
      console.log("Error loading completed tasks:", e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.subtext }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (tasks.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.text }]}>
          No completed tasks yet!
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.subtext }]}>
          {isAdmin
            ? "No users have completed any tasks"
            : "Complete some tasks to see them here"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Completed</Text>
        <View style={isAdmin ? styles.adminBadge : styles.userBadge}>
          <Text style={isAdmin ? styles.adminBadgeText : styles.userBadgeText}>
            {isAdmin ? "Admin" : "User"}
          </Text>
        </View>
      </View>

      <Text style={[styles.subtitle, { color: colors.subtext }]}>
        {tasks.length} completed tasks
      </Text>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() =>
              router.push(
                `/details?id=${item.id}&title=${item.title}&completed=${item.completed}&userId=${item.user_id}&dueDate=${item.due_date || ""}&priority=${item.priority}&category=${item.category || ""}`,
              )
            }
          >
            <View style={styles.cardRow}>
              <View style={styles.dotCompleted} />
              <View style={styles.cardText}>
                <Text
                  style={[styles.taskTitle, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <View style={styles.metaRow}>
                  {item.category && (
                    <Text style={[styles.taskMeta, { color: colors.subtext }]}>
                      {item.category}
                    </Text>
                  )}
                  {item.due_date && (
                    <Text style={[styles.taskMeta, { color: colors.subtext }]}>
                      {" "}
                      • Due: {new Date(item.due_date).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
              <View
                style={[
                  styles.priorityBadge,
                  item.priority === "High"
                    ? styles.highPriority
                    : item.priority === "Low"
                      ? styles.lowPriority
                      : styles.mediumPriority,
                ]}
              >
                <Text style={styles.priorityText}>{item.priority}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dotCompleted: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2e7d32",
    marginRight: 10,
  },
  cardText: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  taskMeta: {
    fontSize: 12,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  highPriority: {
    backgroundColor: "#ffebee",
  },
  mediumPriority: {
    backgroundColor: "#fff3e0",
  },
  lowPriority: {
    backgroundColor: "#e8f5e9",
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#555",
  },
});
