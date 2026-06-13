import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Task = {
  id: string;
  title: string;
  completed: string;
  userId: string;
};

export default function SavedScreen() {
  const [savedTasks, setSavedTasks] = useState<Task[]>([]);

  const loadSavedTasks = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const taskKeys = keys.filter((k) => k.startsWith("task_"));
      const items = await AsyncStorage.multiGet(taskKeys);
      const tasks = items.map((item) => JSON.parse(item[1] as string));
      setSavedTasks(tasks);
    } catch (e) {
      console.log("Error loading tasks", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSavedTasks();
    }, []),
  );

  const deleteTask = async (id: string) => {
    await AsyncStorage.removeItem(`task_${id}`);
    loadSavedTasks();
  };

  if (savedTasks.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>🔖 No saved tasks yet!</Text>
        <Text style={styles.emptySubtext}>Go to Home and save some tasks</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔖 Saved Tasks</Text>
      <FlatList
        data={savedTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.status}>
                {item.completed === "true" ? "✅" : "⏳"}
              </Text>
              <View style={styles.cardText}>
                <Text style={styles.taskTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.taskMeta}>User #{item.userId}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteTask(item.id)}>
                <Text style={styles.delete}>🗑️</Text>
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
  emptyText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#888",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
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
  status: {
    fontSize: 24,
    marginRight: 12,
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
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  delete: {
    fontSize: 20,
    marginLeft: 8,
  },
});
