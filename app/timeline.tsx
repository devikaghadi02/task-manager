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
import { getUserDisplayName } from "../lib/userHelper";

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

type Profile = {
  id: string;
  email: string;
  full_name: string;
};

type Status = "completed" | "overdue" | "due" | "created";

type TaskRow = {
  key: string;
  taskId: string;
  title: string;
  status: Status;
  sortTimestamp: string;
  displayTimestamp: string;
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

const STATUS_META: Record<
  Status,
  { label: string; bg: string; fg: string; icon: string }
> = {
  created: { label: "Created", bg: "#f0f0f0", fg: "#666", icon: "+" },
  due: { label: "Due", bg: "#e3f2fd", fg: "#1976d2", icon: "⏱" },
  overdue: { label: "Overdue", bg: "#ffebee", fg: "#c62828", icon: "!" },
  completed: { label: "Completed", bg: "#e8f5e9", fg: "#2e7d32", icon: "✓" },
};

type ActivityEventType = "created" | "completed";

type ActivityRow = {
  key: string;
  taskId: string;
  title: string;
  userName: string;
  type: ActivityEventType;
  timestamp: string;
};

function buildActivityRows(
  tasks: Task[],
  profileMap: { [key: string]: Profile },
): ActivityRow[] {
  const rows: ActivityRow[] = [];

  tasks.forEach((task) => {
    const userName = getUserDisplayName(task.user_id, profileMap[task.user_id]);

    if (task.created_at) {
      rows.push({
        key: `${task.id}-created`,
        taskId: task.id,
        title: task.title,
        userName,
        type: "created",
        timestamp: task.created_at,
      });
    }

    if (task.completed && task.completed_at) {
      rows.push({
        key: `${task.id}-completed`,
        taskId: task.id,
        title: task.title,
        userName,
        type: "completed",
        timestamp: task.completed_at,
      });
    }
  });

  return rows.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

const ACTIVITY_META: Record<
  ActivityEventType,
  { bg: string; fg: string; icon: string; verb: string }
> = {
  created: { bg: "#f0f0f0", fg: "#666", icon: "+", verb: "created" },
  completed: { bg: "#e8f5e9", fg: "#2e7d32", icon: "✓", verb: "completed" },
};

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

export default function TimelineScreen() {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profileMap, setProfileMap] = useState<{ [key: string]: Profile }>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<"mine" | "activity">("mine");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const admin = user.email === "admin@test.com";
      setIsAdmin(admin);

      const query = supabase.from("tasks").select("*");
      const { data, error: fetchError } = admin
        ? await query
        : await query.eq("user_id", user.id);

      if (fetchError) throw fetchError;
      setTasks((data as Task[]) || []);

      if (admin) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("*");
        const map: { [key: string]: Profile } = {};
        if (profilesData) {
          (profilesData as Profile[]).forEach((p) => {
            map[p.id] = p;
          });
        }
        setProfileMap(map);
      }
    } catch (e) {
      setError("Something went wrong loading the timeline.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const taskRows = useMemo(() => buildTaskRows(tasks), [tasks]);
  const activityRows = useMemo(
    () => buildActivityRows(tasks, profileMap),
    [tasks, profileMap],
  );

  const goToTaskDetails = (task: Task) => {
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
  };

  const renderTaskRow = ({ item }: { item: TaskRow }) => {
    const meta = STATUS_META[item.status];

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          const task = tasks.find((t) => t.id === item.taskId);
          if (task) goToTaskDetails(task);
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

  const renderActivityRow = ({ item }: { item: ActivityRow }) => {
    const meta = ACTIVITY_META[item.type];

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          const task = tasks.find((t) => t.id === item.taskId);
          if (task) goToTaskDetails(task);
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
            <Text style={{ fontWeight: "700" }}>{item.userName}</Text>{" "}
            {meta.verb} "{item.title}"
          </Text>
        </View>
        <Text style={[styles.rowTime, { color: colors.subtext }]}>
          {formatRelative(item.timestamp)}
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

      <Text style={[styles.title, { color: colors.text }]}>
        {viewMode === "mine" ? "Timeline" : "Activity Log"}
      </Text>

      {isAdmin && (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              viewMode === "mine" && styles.toggleButtonActive,
            ]}
            onPress={() => setViewMode("mine")}
          >
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === "mine" && styles.toggleButtonTextActive,
              ]}
            >
              My Tasks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              viewMode === "activity" && styles.toggleButtonActive,
            ]}
            onPress={() => setViewMode("activity")}
          >
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === "activity" && styles.toggleButtonTextActive,
              ]}
            >
              Activity Log
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : viewMode === "mine" ? (
        <FlatList
          data={taskRows}
          keyExtractor={(item) => item.key}
          renderItem={renderTaskRow}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              No activity yet. Create a task to get started!
            </Text>
          }
        />
      ) : (
        <FlatList
          data={activityRows}
          keyExtractor={(item) => item.key}
          renderItem={renderActivityRow}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              No activity yet across any users.
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
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#6200ee",
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  toggleButtonTextActive: {
    color: "#fff",
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
