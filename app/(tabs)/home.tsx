import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

type Task = {
  id: number;
  title: string;
  completed: boolean;
  userId: number;
};

type Section = {
  title: string;
  userId: number;
  data: Task[];
};

export default function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const admin = user.email === "admin@test.com";
      setIsAdmin(admin);
      fetchTasks(admin);
    }
  };

  const fetchTasks = async (admin: boolean) => {
    try {
      const res = await fetch("https://jsonplaceholder.typicode.com/todos");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      if (admin) {
        // Group tasks by userId
        const grouped: { [key: number]: Task[] } = {};
        data.forEach((task: Task) => {
          if (!grouped[task.userId]) {
            grouped[task.userId] = [];
          }
          grouped[task.userId].push(task);
        });

        // Convert to sections array
        const sectionData: Section[] = Object.keys(grouped).map((userId) => ({
          title: `User #${userId}`,
          userId: Number(userId),
          data: grouped[Number(userId)].slice(0, 5), // 5 tasks per user
        }));

        setSections(sectionData);
      } else {
        const userTasks = data.filter((t: Task) => t.userId === 1);
        setTasks(userTasks);
      }
      setLoading(false);
    } catch (err) {
      setError("Something went wrong. Try again!");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Admin view - grouped by user
  if (isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Tasks</Text>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>All users and their tasks</Text>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{section.userId}</Text>
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              <Text style={styles.taskCount}>{section.data.length} tasks</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                router.push(
                  `/details?id=${item.id}&title=${item.title}&completed=${item.completed}&userId=${item.userId}`,
                )
              }
            >
              <View style={styles.cardRow}>
                <View
                  style={[
                    styles.statusDot,
                    item.completed ? styles.dotCompleted : styles.dotPending,
                  ]}
                />
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      </View>
    );
  }

  // User view - their own tasks
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
        <View style={styles.userBadge}>
          <Text style={styles.userBadgeText}>User</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>Showing your tasks ({tasks.length})</Text>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              router.push(
                `/details?id=${item.id}&title=${item.title}&completed=${item.completed}&userId=${item.userId}`,
              )
            }
          >
            <View style={styles.cardRow}>
              <View
                style={[
                  styles.statusDot,
                  item.completed ? styles.dotCompleted : styles.dotPending,
                ]}
              />
              <View style={styles.cardText}>
                <Text style={styles.taskTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.taskMeta}>User #{item.userId}</Text>
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingVertical: 10,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  taskCount: {
    fontSize: 12,
    color: "#888",
  },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
    elevation: 1,
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
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  taskMeta: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
});
