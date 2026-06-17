import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { cancelTaskReminder } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { getCategoryColor, getUserDisplayName } from "../lib/userHelper";

type Subtask = {
  id: string;
  title: string;
  completed: boolean;
  position: number;
};

function formatDueDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value);
  if (str === "" || str === "undefined" || str === "null") return null;
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
}

export default function DetailsScreen() {
  const params = useLocalSearchParams();
  const id = params.id ? String(params.id) : "";
  const userId = params.userId ? String(params.userId) : "";
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(params.completed === "true");
  const { colors } = useTheme();
  const [userName, setUserName] = useState<string>("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Task fields as local state, seeded from the initial route params but
  // refreshed from Supabase whenever this screen regains focus (e.g. after
  // returning from the Edit screen), so saved changes show up immediately
  // instead of waiting for params to be passed again from the task list.
  const [taskTitle, setTaskTitle] = useState(
    params.title ? String(params.title) : "",
  );
  const [taskDueDate, setTaskDueDate] = useState(
    params.dueDate ? String(params.dueDate) : "",
  );
  const [taskPriority, setTaskPriority] = useState(
    params.priority ? String(params.priority) : "",
  );
  const [taskCategory, setTaskCategory] = useState(
    params.category ? String(params.category) : "",
  );

  const refetchTask = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", String(id))
        .single();

      if (!error && data) {
        setTaskTitle(data.title ?? "");
        setTaskDueDate(data.due_date ?? "");
        setTaskPriority(data.priority ?? "");
        setTaskCategory(data.category ?? "");
        setIsCompleted(!!data.completed);
      }
    } catch (e) {
      console.log("Error refetching task:", e);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refetchTask();
    }, [refetchTask]),
  );

  useEffect(() => {
    fetchProfile();
    fetchSubtasks();
  }, [userId]);

  const fetchProfile = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", String(userId))
        .single();
      setUserName(getUserDisplayName(String(userId), error ? null : data));
    } catch (e) {
      setUserName(getUserDisplayName(String(userId), null));
    }
  };

  const fetchSubtasks = async () => {
    try {
      const { data, error } = await supabase
        .from("subtasks")
        .select("*")
        .eq("task_id", String(id))
        .order("position", { ascending: true });

      if (!error && data) setSubtasks(data as Subtask[]);
    } catch (e) {
      console.log("Error fetching subtasks:", e);
    }
  };

  const addSubtask = async () => {
    if (!newSubtask.trim()) return;
    setAddingSubtask(true);
    try {
      const nextPosition =
        subtasks.length > 0
          ? Math.max(...subtasks.map((s) => s.position)) + 1
          : 0;

      const { data, error } = await supabase
        .from("subtasks")
        .insert({
          task_id: String(id),
          title: newSubtask.trim(),
          position: nextPosition,
        })
        .select()
        .single();

      if (!error && data) {
        setSubtasks([...subtasks, data as Subtask]);
        setNewSubtask("");
      }
    } catch (e) {
      console.log("Error adding subtask:", e);
    }
    setAddingSubtask(false);
  };

  const toggleSubtask = async (subtask: Subtask) => {
    try {
      const { error } = await supabase
        .from("subtasks")
        .update({ completed: !subtask.completed })
        .eq("id", subtask.id);

      if (!error) {
        setSubtasks(
          subtasks.map((s) =>
            s.id === subtask.id ? { ...s, completed: !s.completed } : s,
          ),
        );
      }
    } catch (e) {
      console.log("Error toggling subtask:", e);
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    try {
      await supabase.from("subtasks").delete().eq("id", subtaskId);
      setSubtasks(subtasks.filter((s) => s.id !== subtaskId));
    } catch (e) {
      console.log("Error deleting subtask:", e);
    }
  };

  const startEditingSubtask = (subtask: Subtask) => {
    setEditingId(subtask.id);
    setEditingTitle(subtask.title);
  };

  const cancelEditingSubtask = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const saveSubtaskEdit = async () => {
    if (!editingId || !editingTitle.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("subtasks")
        .update({ title: editingTitle.trim() })
        .eq("id", editingId);

      if (!error) {
        setSubtasks(
          subtasks.map((s) =>
            s.id === editingId ? { ...s, title: editingTitle.trim() } : s,
          ),
        );
        setEditingId(null);
        setEditingTitle("");
      }
    } catch (e) {
      console.log("Error editing subtask:", e);
    }
    setSavingEdit(false);
  };

  const toggleCompletion = async () => {
    setLoading(true);
    try {
      const newCompleted = !isCompleted;

      const { error } = await supabase
        .from("tasks")
        .update({ completed: newCompleted })
        .eq("id", String(id));

      if (error) throw error;

      if (newCompleted) {
        await cancelTaskReminder(String(id));
      }
      setIsCompleted(newCompleted);
    } catch (e: any) {
      Alert.alert("Error", "Failed to update task status.");
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async () => {
    setLoading(true);
    try {
      await cancelTaskReminder(String(id));

      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", String(id));

      if (error) throw error;
      router.back();
    } catch (e: any) {
      Alert.alert("Error", "Failed to delete task.");
      setLoading(false);
    }
  };

  const categoryColor = getCategoryColor(taskCategory || null);
  const completedSubtasks = subtasks.filter((s) => s.completed).length;
  const formattedDueDate = formatDueDate(taskDueDate);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      data={subtasks}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {!isCompleted && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() =>
                  router.push({
                    pathname: "/create-task",
                    params: {
                      id: String(id),
                      title: taskTitle,
                      category: taskCategory,
                      priority: taskPriority || "Medium",
                      dueDate: taskDueDate,
                    },
                  })
                }
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isCompleted ? "#e8f5e9" : "#fff3e0" },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: isCompleted ? "#2e7d32" : "#e65100" },
              ]}
            >
              {isCompleted ? "Completed" : "Pending"}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {taskTitle}
          </Text>

          <View
            style={[styles.metaContainer, { backgroundColor: colors.card }]}
          >
            {formattedDueDate ? (
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.subtext }]}>
                  Due Date
                </Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>
                  {formattedDueDate}
                </Text>
              </View>
            ) : null}

            {taskPriority ? (
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.subtext }]}>
                  Priority
                </Text>
                <View
                  style={[
                    styles.priorityBadge,
                    taskPriority === "High"
                      ? styles.highPriority
                      : taskPriority === "Low"
                        ? styles.lowPriority
                        : styles.mediumPriority,
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityText,
                      taskPriority === "High" ? styles.highPriorityText : null,
                    ]}
                  >
                    {taskPriority}
                  </Text>
                </View>
              </View>
            ) : null}

            {taskCategory ? (
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.subtext }]}>
                  Category
                </Text>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: categoryColor + "22" },
                  ]}
                >
                  <Text style={[styles.categoryText, { color: categoryColor }]}>
                    {taskCategory}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.subtext }]}>
                Assigned to
              </Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {userName || String(userId).substring(0, 8) + "..."}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                isCompleted ? styles.pendingButton : styles.completeButton,
              ]}
              onPress={toggleCompletion}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>
                {loading
                  ? "Wait..."
                  : isCompleted
                    ? "Mark Pending"
                    : "Mark Complete"}
              </Text>
            </TouchableOpacity>
            {!isCompleted && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => {
                  Alert.alert(
                    "Delete Task",
                    "Are you sure you want to delete this task?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: deleteTask,
                      },
                    ],
                  );
                }}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Delete Task</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.subtasksHeader}>
            <Text style={[styles.subtasksTitle, { color: colors.text }]}>
              Subtasks
            </Text>
            <Text style={[styles.subtasksCount, { color: colors.subtext }]}>
              {completedSubtasks}/{subtasks.length} done
            </Text>
          </View>

          <View
            style={[
              styles.addSubtaskRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              style={[styles.subtaskInput, { color: colors.text }]}
              placeholder="Add a subtask..."
              placeholderTextColor={colors.subtext}
              value={newSubtask}
              onChangeText={setNewSubtask}
              onSubmitEditing={addSubtask}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={addSubtask}
              disabled={addingSubtask}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <View style={[styles.subtaskCard, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.subtaskCheckbox}
            onPress={() => toggleSubtask(item)}
          >
            <View
              style={[
                styles.checkbox,
                item.completed && styles.checkboxChecked,
              ]}
            >
              {item.completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>

          {editingId === item.id ? (
            <>
              <TextInput
                style={[
                  styles.subtaskEditInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={editingTitle}
                onChangeText={setEditingTitle}
                autoFocus
                onSubmitEditing={saveSubtaskEdit}
              />
              <TouchableOpacity onPress={saveSubtaskEdit} disabled={savingEdit}>
                <Text style={styles.subtaskSaveLink}>
                  {savingEdit ? "..." : "Save"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={cancelEditingSubtask}
                style={{ marginLeft: 8 }}
              >
                <Text style={styles.subtaskCancelLink}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.subtaskTitle,
                  { color: colors.text },
                  item.completed && styles.subtaskCompleted,
                ]}
              >
                {item.title}
              </Text>
              <TouchableOpacity
                onPress={() => startEditingSubtask(item)}
                style={styles.subtaskEditButton}
              >
                <Text style={styles.subtaskEditIcon}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteSubtask(item.id)}>
                <Text style={styles.subtaskDelete}>✕</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
      ListEmptyComponent={
        <Text style={[styles.emptySubtasks, { color: colors.subtext }]}>
          No subtasks yet. Add one above!
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  backButton: {},
  backText: {
    fontSize: 16,
    color: "#6200ee",
    fontWeight: "bold",
  },
  editButton: {
    paddingHorizontal: 4,
  },
  editButtonText: {
    fontSize: 16,
    color: "#6200ee",
    fontWeight: "bold",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    lineHeight: 30,
  },
  metaContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    elevation: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
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
  highPriorityText: {
    color: "#c62828",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },
  completeButton: {
    backgroundColor: "#2e7d32",
  },
  pendingButton: {
    backgroundColor: "#f9a825",
  },
  deleteButton: {
    backgroundColor: "#c62828",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  subtasksHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  subtasksTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  subtasksCount: {
    fontSize: 13,
  },
  addSubtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  subtaskInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  addButton: {
    backgroundColor: "#6200ee",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 22,
  },
  subtaskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    elevation: 1,
  },
  subtaskCheckbox: {
    marginRight: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  subtaskTitle: {
    flex: 1,
    fontSize: 15,
  },
  subtaskCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  subtaskEditButton: {
    paddingHorizontal: 8,
  },
  subtaskEditIcon: {
    color: "#6200ee",
    fontSize: 16,
  },
  subtaskDelete: {
    color: "#c62828",
    fontSize: 16,
    paddingHorizontal: 4,
  },
  subtaskEditInput: {
    flex: 1,
    borderBottomWidth: 1,
    fontSize: 15,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginRight: 8,
  },
  subtaskSaveLink: {
    color: "#6200ee",
    fontWeight: "bold",
    fontSize: 13,
  },
  subtaskCancelLink: {
    color: "#999",
    fontSize: 13,
  },
  emptySubtasks: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 8,
  },
});
