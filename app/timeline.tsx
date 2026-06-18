import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";

type Task = {
  id: string;
  title: string;
  completed: boolean;
  user_id: string;
  due_date: string | null;
  priority: string;
  category: string | null;
  created_at: string | null;
  completed_at: string | null;
};

// Priority order when deciding which single status a task's row shows:
// Completed beats Overdue beats Due beats Created.
type Status = "completed" | "overdue" | "due" | "created";

type TaskRow = {
  key: string;
  taskId: string;
  title: string;
  status: Status;
  // Timestamp used for SORTING the feed — matches whichever timestamp
  // corresponds to the row's status (completed_at for completed,
  // due_date for overdue/due, created_at for created-only).
  sortTimestamp: string;
  // Timestamp shown on the right side of the row — same value as
  // sortTimestamp in this one-row-per-task model.
  displayTimestamp: string;
  // Subtitle always shows due-date info when a due date exists,
  // regardless of status — falls back to "No due date" otherwise.
  subtitle: string;
};

function formatShortDue(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  const weekday = date.toLocaleDateString([], { weekday: "short" });
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Due ${weekday} ${time}`;
}

function buildTaskRows(tasks: Task[]): TaskRow[] {
  const now = Date.now();

  const rows: TaskRow[] = tasks.map((task) => {
    const dueTime = task.due_date ? new Date(task.due_date).getTime() : NaN;
    const hasValidDue = task.due_date && !isNaN(dueTime);

    let status: Status;
    let sortTimestamp: string;

    if (task.completed) {
      status = "completed";
      sortTimestamp =
        task.completed_at || task.due_date || task.created_at || "";
    } else if (hasValidDue && dueTime < now) {
      status = "overdue";
      sortTimestamp = task.due_date as string;
    } else if (hasValidDue) {
      status = "due";
      sortTimestamp = task.due_date as string;
    } else {
      status = "created";
      sortTimestamp = task.created_at || "";
    }

    const subtitle = hasValidDue
      ? formatShortDue(task.due_date as string)
      : "No due date";

    return {
      key: task.id,
      taskId: task.id,
      title: task.title,
      status,
      sortTimestamp,
      displayTimestamp: sortTimestamp,
      subtitle,
    };
  });

  return rows.sort(
    (a, b) =>
      new Date(b.sortTimestamp).getTime() - new Date(a.sortTimestamp).getTime(),
  );
}

function formatRelative(timestamp: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString()}, ${time}`;
}

const STATUS_META: Record<
  Status,
  { label: string; bg: string; fg: string; icon: string }
> = {
  created: { label: "Created", bg: "#f0f0f0", fg: "#666", icon: "+" },
  due: { label: "Due", bg: "#e3f2fd", fg: "#1976d2", icon: "⏱" },
  overdue: { label: "Overdue", bg: "#ffebee", fg: "#c62828", icon: "!" },
  completed: { label: "Completed", bg: "#e8f5e9", fg: "#2e7d32", icon: "✓" },
};

export default function TimelineScreen() {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTasks = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const admin = user.email === "admin@test.com";

      const query = supabase.from("tasks").select("*");
      const { data, error: fetchError } = admin
        ? await query
        : await query.eq("user_id", user.id);

      if (fetchError) throw fetchError;
      setTasks((data as Task[]) || []);
    } catch (e) {
      setError("Something went wrong loading the timeline.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const rows = useMemo(() => buildTaskRows(tasks), [tasks]);

  const renderItem = ({ item }: { item: TaskRow }) => {
    const meta = STATUS_META[item.status];

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          const task = tasks.find((t) => t.id === item.taskId);
          if (!task) return;
          router.push({
            pathname: "/details",
            params: {
              id: task.id,
              title: task.title,
              completed: String(task.completed),
              userId: task.user_id,
              dueDate: task.due_date || "",
              priority: task.priority,
              category: task.category || "",
            },
          });
        }}
      >
        <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
          <Text style={[styles.iconText, { color: meta.fg }]}>{meta.icon}</Text>
        </View>
        <View style={styles.rowText}>
          <Text
            style={[styles.rowTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={[styles.rowSubtitle, { color: colors.subtext }]}>
            {item.subtitle}
          </Text>
        </View>
        <Text style={[styles.rowTime, { color: colors.subtext }]}>
          {formatRelative(item.displayTimestamp)}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.text }]}>Timeline</Text>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              No activity yet. Create a task to get started!
            </Text>
          }
        />
      )}
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
  backButton: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: "#6200ee",
    fontWeight: "bold",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  rowText: {
    flex: 1,
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  rowTime: {
    fontSize: 12,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
  errorText: {
    fontSize: 16,
    color: "red",
    textAlign: "center",
    marginTop: 40,
  },
});
