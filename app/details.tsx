import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { getCategoryColor, getUserDisplayName } from "../lib/userHelper";

type Subtask = {
  id: string;
  title: string;
  completed: boolean;
  position: number;
};

type TaskOption = {
  id: string;
  title: string;
  completed: boolean;
};

function formatDueDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value);
  if (str === "" || str === "undefined" || str === "null") return null;
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
}

function formatDateTime(value: unknown): string | null {
  if (!value) return null;
  const str = String(value);
  if (str === "" || str === "undefined" || str === "null") return null;
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

const logHistory = async (taskId: string, action: string, detail?: string) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    let actorName = user.email?.split("@")[0] || "Unknown";
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (profile?.full_name) actorName = profile.full_name;

    await supabase.from("task_history").insert({
      task_id: taskId,
      action,
      detail: detail || null,
      actor_name: actorName,
      actor_email: user.email,
    });
  } catch (e) {
    console.log("Error logging history:", e);
  }
};

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
  const [notes, setNotes] = useState(params.notes ? String(params.notes) : "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(true);
  const [history, setHistory] = useState<
    {
      id: string;
      action: string;
      detail: string | null;
      actor_name: String;
      created_at: string;
    }[]
  >([]);

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
  const [taskCreatedAt, setTaskCreatedAt] = useState("");
  const [taskCompletedAt, setTaskCompletedAt] = useState<string | null>(null);

  // --- Dependency state ---
  const [blockedById, setBlockedById] = useState<string | null>(null);
  const [blockedByTitle, setBlockedByTitle] = useState<string>("");
  const [blockedByCompleted, setBlockedByCompleted] = useState<boolean>(false);
  const [reaction, setReactionState] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [depPickerVisible, setDepPickerVisible] = useState(false);
  const [depSearchText, setDepSearchText] = useState("");
  const [allTasks, setAllTasks] = useState<TaskOption[]>([]);
  const [reassignPickerVisible, setReassignPickerVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<
    { id: String; full_name: string | null; email: string }[]
  >([]);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [reassignNoteVisible, setReassignNoteVisible] = useState(false);
  const [reassignNote, setReassignNote] = useState("");
  const [pendingReassign, setPendingReassign] = useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [rejectNoteVisible, setRejectNoteVisible] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

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
        setNotes(data.notes ?? "");
        setTaskCreatedAt(data.created_at ?? "");
        setTaskCompletedAt(data.completed_at ?? null);
        setReactionState(data.reaction ?? null);
        setReviewStatus(data.review_status ?? null);

        // Load blocking task details if a dependency is set
        if (data.blocked_by) {
          setBlockedById(data.blocked_by);
          const { data: blocker } = await supabase
            .from("tasks")
            .select("id, title, completed")
            .eq("id", data.blocked_by)
            .single();
          if (blocker) {
            setBlockedByTitle(blocker.title ?? "");
            setBlockedByCompleted(!!blocker.completed);
          }
        } else {
          setBlockedById(null);
          setBlockedByTitle("");
          setBlockedByCompleted(false);
        }
      } else if (error) {
        console.log("Error refetching task:", error);
      }
    } catch (e) {
      console.log("Error refetching task:", e);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refetchTask();
      fetchHistory();
    }, [refetchTask]),
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setIsAdmin(user.email === "admin@test.com");
    });
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchSubtasks();
    fetchHistory();
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

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("task_history")
        .select("*")
        .eq("task_id", String(id))
        .order("created_at", { ascending: false });
      if (!error && data) setHistory(data);
    } catch (e) {
      console.log("Error fetching history:", e);
    }
  };

  const fetchAllUsersForPicker = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      if (!error && data) setAllUsers(data);
    } catch (e) {
      console.log("Error fetching users for picker:", e);
    }
  };

  const openReassignPicker = async () => {
    await fetchAllUsersForPicker();
    setReassignPickerVisible(true);
  };

  const reassignTask = async (newUserId: string, newUserName: string) => {
    setReassignPickerVisible(false);
    setPendingReassign({ userId: newUserId, userName: newUserName });
    setReassignNote("");
    setReassignNoteVisible(true);
  };

  const confirmReassign = async () => {
    if (!pendingReassign) return;
    const oldUserName = userName;
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ user_id: pendingReassign.userId })
        .eq("id", String(id));
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      setUserName(pendingReassign.userName);
      const detail = reassignNote.trim()
        ? `from ${oldUserName} to ${pendingReassign.userName} — ${reassignNote.trim()}`
        : `from ${oldUserName} to ${pendingReassign.userName}`;
      logHistory(String(id), "reassigned", detail);
      fetchHistory();
    } catch (e) {
      console.log("Error reassigning task:", e);
    } finally {
      setReassignNoteVisible(false);
      setPendingReassign(null);
      setReassignNote("");
    }
  };

  const openDepPicker = async () => {
    await fetchAllTasksForPicker();
    setDepSearchText("");
    setDepPickerVisible(true);
  };

  const setDependency = async (blocker: TaskOption) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ blocked_by: blocker.id })
        .eq("id", String(id));
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      setBlockedById(blocker.id);
      setBlockedByTitle(blocker.title);
      setBlockedByCompleted(blocker.completed);
      setDepPickerVisible(false);
      logHistory(
        String(id),
        "dependency added",
        `blocked by "${blocker.title}"`,
      );
    } catch (e) {
      console.log("Error setting dependency:", e);
    }
  };

  const clearDependency = async () => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ blocked_by: null })
        .eq("id", String(id));
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      setBlockedById(null);
      setBlockedByTitle("");
      setBlockedByCompleted(false);
    } catch (e) {
      console.log("Error clearing dependency:", e);
    }
  };

  const saveReaction = async (emoji: string | null) => {
    try {
      const newReaction = reaction == emoji ? null : emoji;
      const { error } = await supabase
        .from("tasks")
        .update({ reaction: newReaction })
        .eq("id", String(id));
      if (!error) setReactionState(newReaction);
    } catch (e) {
      console.log("Error saving reaction: ", e);
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

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .update({ notes })
        .eq("id", String(id))
        .select();

      if (error) {
        console.log("Error saving notes:", error);
        Alert.alert("Error", `Failed to save notes: ${error.message}`);
      } else if (!data || data.length === 0) {
        console.log("Notes update affected 0 rows.", { id, notes });
        Alert.alert(
          "Not Saved",
          "No matching task row was updated. This usually points to a permissions (RLS) or id mismatch.",
        );
      } else {
        console.log("Notes saved successfully:", data[0]);
        setNotesSaved(true);
      }
    } catch (e) {
      console.log("Error saving notes:", e);
      Alert.alert("Error", "Something went wrong saving your notes.");
    }
    setSavingNotes(false);
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
    // Block completion if the dependency task isn't done yet
    if (!isCompleted && blockedById && !blockedByCompleted) {
      Alert.alert(
        "Task Blocked",
        `This task is blocked by "${blockedByTitle}", which isn't completed yet. Finish that task first.`,
      );
      return;
    }

    setLoading(true);
    try {
      const nowCompleted = !isCompleted;

      if (isAdmin) {
        //Admin marking complete/pending directly skips review entirely
        const newCompletedAt = nowCompleted ? new Date().toISOString() : null;
        const { error } = await supabase
          .from("tasks")
          .update({
            completed: nowCompleted,
            completed_at: newCompletedAt,
            review_status: nowCompleted ? "approved" : null,
          })
          .eq("id", String(id));

        if (error) throw error;
        setIsCompleted(nowCompleted);
        setTaskCompletedAt(newCompletedAt);
        logHistory(String(id), nowCompleted ? "completed" : "reopened");
      } else if (nowCompleted) {
        //Regular user marking complete -> goes to pending review, not actually completed yet
        const { error } = await supabase
          .from("tasks")
          .update({ review_status: "pending_review" })
          .eq("id", String(id));

        if (error) throw error;
        setIsCompleted(true); //visually looks done to the user
        logHistory(String(id), "submitted for review ");
      } else {
        //User un-marking befire admin reviewed - just clear review status
        const { error } = await supabase
          .from("tasks")
          .update({ review_status: null })
          .eq("id", String(id));

        if (error) throw error;
        setIsCompleted(false);
        logHistory(String(id), "reopened");
      }
    } catch (e: any) {
      Alert.alert("Error", "Failed to update task status.");
    } finally {
      setLoading(false);
    }
  };

  const approveTask = async () => {
    setLoading(true);
    try {
      const newCompletedAt = new Date().toISOString();
      const { error, data } = await supabase
        .from("tasks")
        .update({
          completed: true,
          completed_at: newCompletedAt,
          review_status: "approved",
        })
        .eq("id", String(id));
      console.log("Approve result:", { error, data });
      if (error) throw error;
      setIsCompleted(true);
      setTaskCompletedAt(newCompletedAt);
      setReviewStatus("approved");
      logHistory(String(id), "approved");
    } catch (e) {
      console.log("Approve exception:", e);
      Alert.alert("Error", "Failed to approve task.");
    } finally {
      setLoading(false);
    }
  };

  const rejectTask = () => {
    setRejectNote("");
    setRejectNoteVisible(true);
  };

  const confirmReject = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          completed: false,
          completed_at: null,
          review_status: "rejected",
        })
        .eq("id", String(id));
      if (error) throw error;
      setIsCompleted(false);
      setTaskCompletedAt(null);
      setReviewStatus("rejected");
      const detail = rejectNote.trim() ? rejectNote.trim() : undefined;
      logHistory(String(id), "rejected", detail);
      fetchHistory();
    } catch (e) {
      Alert.alert("Error", "Failed to reject task.");
    } finally {
      setLoading(false);
      setRejectNoteVisible(false);
      setRejectNote("");
    }
  };

  const deleteTask = async () => {
    setLoading(true);
    try {
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

  const saveAsTemplate = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Save the template
      const { data: template, error: templateError } = await supabase
        .from("templates")
        .insert({
          user_id: user.id,
          title: taskTitle,
          priority: taskPriority || "Medium",
          category: taskCategory || null,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Save subtasks if any exist
      if (subtasks.length > 0) {
        const templateSubtasks = subtasks.map((s, i) => ({
          template_id: template.id,
          title: s.title,
          position: i,
        }));

        const { error: subtasksError } = await supabase
          .from("template_subtasks")
          .insert(templateSubtasks);

        if (subtasksError) throw subtasksError;
      }

      Alert.alert("Template Saved", `"${taskTitle}" saved as a template!`);
    } catch (e: any) {
      console.log("Error saving template:", e);
      Alert.alert("Error", "Failed to save template.");
    }
  };

  const categoryColor = getCategoryColor(taskCategory || null);
  const completedSubtasks = subtasks.filter((s) => s.completed).length;
  const formattedDueDate = formatDueDate(taskDueDate);
  const formattedCreatedAt = formatDateTime(taskCreatedAt);
  const formattedCompletedAt = isCompleted
    ? formatDateTime(taskCompletedAt)
    : null;
  const isOverdue =
    !isCompleted &&
    !!taskDueDate &&
    !isNaN(new Date(taskDueDate).getTime()) &&
    new Date(taskDueDate).getTime() < Date.now();

  const isBlocked = !!blockedById && !blockedByCompleted;
  const filteredDepTasks = allTasks.filter((t) =>
    t.title.toLowerCase().includes(depSearchText.toLowerCase()),
  );

  return (
    <>
      {/* Dependency picker — bottom sheet modal */}
      <Modal
        visible={depPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDepPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Block until task is done
              </Text>
              <TouchableOpacity onPress={() => setDepPickerVisible(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.depSearchInput,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Search tasks..."
              placeholderTextColor={colors.subtext}
              value={depSearchText}
              onChangeText={setDepSearchText}
            />
            <FlatList
              data={filteredDepTasks}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.depPickerRow,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => setDependency(item)}
                >
                  <View
                    style={[
                      styles.depPickerDot,
                      item.completed ? styles.depDotDone : styles.depDotPending,
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.depPickerTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.depPickerStatus,
                        { color: colors.subtext },
                      ]}
                    >
                      {item.completed ? "Completed" : "Pending"}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.depEmpty, { color: colors.subtext }]}>
                  No other tasks found.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={reassignPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReassignPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Reassign to
              </Text>
              <TouchableOpacity onPress={() => setReassignPickerVisible(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={allUsers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const name = getUserDisplayName(item.id, name);
                return (
                  <TouchableOpacity
                    style={[
                      styles.depPickerRow,
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={() => reassignTask(item.id, name)}
                  >
                    <Text
                      style={[styles.depPickerTitle, { color: colors.text }]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.depEmpty, { color: colors.subtext }]}>
                  No users found.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={reassignNoteVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReassignNoteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Reassignment Note
              </Text>
              <TouchableOpacity onPress={() => setReassignNoteVisible(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text
              style={[
                { color: colors.subtext, fontSize: 13, marginBottom: 12 },
              ]}
            >
              Add an optional note for reassigning to{" "}
              {pendingReassign?.userName}
            </Text>
            <TextInput
              style={[
                styles.depSearchInput,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="e.g. Alice is on leave..."
              placeholderTextColor={colors.subtext}
              value={reassignNote}
              onChangeText={setReassignNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.completeButton,
                { marginTop: 16 },
              ]}
              onPress={confirmReassign}
            >
              <Text style={styles.actionButtonText}>Confirm Reassign</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={rejectNoteVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectNoteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Rejection Reason
              </Text>
              <TouchableOpacity onPress={() => setRejectNoteVisible(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text
              style={[
                { color: colors.subtext, fontSize: 13, marginBottom: 12 },
              ]}
            >
              Add on optional reason for rejecting this task
            </Text>
            <TextInput
              style={[
                styles.depSearchInput,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="e.g. Needs more detail..."
              placeholderTextColor={colors.subtext}
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.deleteButton,
                { marginTop: 16 },
              ]}
              onPress={confirmReject}
            >
              <Text style={styles.actionButtonText}>Confirm Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.templateButton}
                  onPress={saveAsTemplate}
                >
                  <Text style={styles.templateButtonText}>Save Template</Text>
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
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    isAdmin && reviewStatus === "pending_review"
                      ? "#ede7f6"
                      : isCompleted
                        ? "#e8f5e9"
                        : isBlocked
                          ? "#fff8e1"
                          : "#fff3e0",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      isAdmin && reviewStatus === "pending_review"
                        ? "#5e35b1"
                        : isCompleted
                          ? "#2e7d32"
                          : isBlocked
                            ? "#b45309"
                            : "#e65100",
                  },
                ]}
              >
                {isAdmin && reviewStatus === "pending_review"
                  ? "Pending Review"
                  : isCompleted
                    ? "Completed"
                    : isBlocked
                      ? "Blocked"
                      : "Pending"}
              </Text>
            </View>
            {/* Reaction row — admin can react to completed tasks */}
            {isCompleted && (
              <View style={styles.reactionRow}>
                {isAdmin ? (
                  <>
                    {["👍", "🔥", "✨", "🎉"].map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          styles.reactionBtn,
                          reaction === emoji && styles.reactionBtnActive,
                        ]}
                        onPress={() => saveReaction(emoji)}
                      >
                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                    {reaction && (
                      <TouchableOpacity
                        onPress={() => saveReaction(null)}
                        style={styles.reactionClear}
                      >
                        <Text style={styles.reactionClearText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : reaction ? (
                  <View style={styles.reactionDisplay}>
                    <Text style={styles.reactionDisplayEmoji}>{reaction}</Text>
                    <Text style={styles.reactionDisplayLabel}>
                      Admin reacted
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            <Text style={[styles.title, { color: colors.text }]}>
              {taskTitle}
            </Text>

            {/* Dependency banner — shown when a blocker is set */}
            {blockedById ? (
              <View
                style={[
                  styles.depBanner,
                  {
                    backgroundColor: blockedByCompleted ? "#e8f5e9" : "#fff8e1",
                    borderColor: blockedByCompleted ? "#2e7d32" : "#f9a825",
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.depBannerLabel,
                      { color: blockedByCompleted ? "#2e7d32" : "#b45309" },
                    ]}
                  >
                    {blockedByCompleted ? "DEPENDENCY DONE" : "BLOCKED BY"}
                  </Text>
                  <Text
                    style={[styles.depBannerTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {blockedByTitle}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={clearDependency}
                  style={styles.depClearButton}
                >
                  <Text style={styles.depClearText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.depAddButton,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
                onPress={openDepPicker}
              >
                <Text style={[styles.depAddText, { color: colors.subtext }]}>
                  + Add dependency
                </Text>
              </TouchableOpacity>
            )}

            <View
              style={[styles.timelineCard, { backgroundColor: colors.card }]}
            >
              <View style={styles.timelineRow}>
                <View style={styles.timelineStop}>
                  <View
                    style={[styles.timelineDot, styles.timelineDotCreated]}
                  />
                  <Text
                    style={[styles.timelineLabel, { color: colors.subtext }]}
                  >
                    Created
                  </Text>
                  <Text style={[styles.timelineValue, { color: colors.text }]}>
                    {formattedCreatedAt || "—"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.timelineConnector,
                    { backgroundColor: colors.border },
                  ]}
                />
                <View style={styles.timelineStop}>
                  <View
                    style={[
                      styles.timelineDot,
                      isOverdue
                        ? styles.timelineDotOverdue
                        : styles.timelineDotDue,
                    ]}
                  />
                  <Text
                    style={[styles.timelineLabel, { color: colors.subtext }]}
                  >
                    Due
                  </Text>
                  <Text style={[styles.timelineValue, { color: colors.text }]}>
                    {formattedDueDate || "—"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.timelineConnector,
                    { backgroundColor: colors.border },
                  ]}
                />
                <View style={styles.timelineStop}>
                  <View
                    style={[
                      styles.timelineDot,
                      formattedCompletedAt
                        ? styles.timelineDotCompleted
                        : styles.timelineDotEmpty,
                      { borderColor: colors.border },
                    ]}
                  />
                  <Text
                    style={[styles.timelineLabel, { color: colors.subtext }]}
                  >
                    Completed
                  </Text>
                  <Text style={[styles.timelineValue, { color: colors.text }]}>
                    {formattedCompletedAt || "—"}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[styles.metaContainer, { backgroundColor: colors.card }]}
            >
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
                        taskPriority === "High"
                          ? styles.highPriorityText
                          : null,
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
                    <Text
                      style={[styles.categoryText, { color: categoryColor }]}
                    >
                      {taskCategory}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.subtext }]}>
                  Assigned to
                </Text>
                {isAdmin ? (
                  <TouchableOpacity onPress={openReassignPicker}>
                    <Text style={[styles.metaValue, styles.metaValueLink]}>
                      {userName || String(userId).substring(0, 8) + "..."}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.metaValue, { color: colors.text }]}>
                    {userName || String(userId).substring(0, 8) + "..."}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.actions}>
              {isAdmin && reviewStatus === "pending_review" ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.completeButton]}
                    onPress={approveTask}
                    disabled={loading}
                  >
                    <Text style={styles.actionButtonText}>
                      {loading ? "Wait..." : "Approve"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={rejectTask}
                    disabled={loading}
                  >
                    <Text style={styles.actionButtonText}>
                      {loading ? "Wait..." : "Reject"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : isAdmin && reviewStatus === "approved" ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.pendingButton]}
                  onPress={async () => {
                    setLoading(true);
                    try {
                      const { error } = await supabase
                        .from("tasks")
                        .update({ review_status: "pending_review" })
                        .eq("id", String(id));
                      if (error) throw error;
                      setReviewStatus("pending_review");
                      logHistory(
                        String(id),
                        "approval undone — back to review",
                      );
                    } catch (e) {
                      Alert.alert("Error", "Failed to undo approval.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  <Text style={styles.actionButtonText}>
                    {loading ? "Wait..." : "✓ Approved"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      isCompleted
                        ? styles.pendingButton
                        : isBlocked
                          ? styles.blockedButton
                          : styles.completeButton,
                    ]}
                    onPress={toggleCompletion}
                    disabled={loading}
                  >
                    <Text style={styles.actionButtonText}>
                      {loading
                        ? "Wait..."
                        : isCompleted
                          ? "Mark Pending"
                          : isBlocked
                            ? "Blocked"
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
                </>
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
                <TouchableOpacity
                  onPress={saveSubtaskEdit}
                  disabled={savingEdit}
                >
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
        ListFooterComponent={
          <View style={styles.notesSection}>
            <View style={styles.notesHeader}>
              <Text style={[styles.notesTitle, { color: colors.text }]}>
                Notes
              </Text>
              {!notesSaved && (
                <TouchableOpacity onPress={saveNotes} disabled={savingNotes}>
                  <Text style={styles.notesSaveLink}>
                    {savingNotes ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Add notes about this task..."
              placeholderTextColor={colors.subtext}
              value={notes}
              onChangeText={(text) => {
                setNotes(text);
                setNotesSaved(false);
              }}
              onBlur={saveNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.activitySection}>
              <Text style={[styles.notesTitle, { color: colors.text }]}>
                Activity
              </Text>
              {history.length === 0 ? (
                <Text style={[styles.activityEmpty, { color: colors.subtext }]}>
                  No activity yet.
                </Text>
              ) : (
                history.map((h) => (
                  <View key={h.id} style={styles.activityRow}>
                    <View style={styles.activityDot} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.activityText, { color: colors.text }]}
                      >
                        <Text style={{ fontWeight: "700" }}>
                          {h.actor_name}
                        </Text>{" "}
                        {h.action}
                        {h.detail ? ` — ${h.detail}` : ""}
                      </Text>
                      <Text
                        style={[styles.activityTime, { color: colors.subtext }]}
                      >
                        {new Date(h.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  backButton: {},
  backText: { fontSize: 16, color: "#6200ee", fontWeight: "bold" },
  editButton: { paddingHorizontal: 4 },
  editButtonText: { fontSize: 16, color: "#6200ee", fontWeight: "bold" },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusText: { fontSize: 14, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 12, lineHeight: 30 },
  depBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  depBannerLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
    letterSpacing: 0.6,
  },
  depBannerTitle: { fontSize: 14, fontWeight: "600" },
  depClearButton: { paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  depClearText: { color: "#c62828", fontSize: 12, fontWeight: "600" },
  depAddButton: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    alignItems: "center",
  },
  depAddText: { fontSize: 13, fontWeight: "500" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  modalClose: { fontSize: 15, color: "#6200ee", fontWeight: "600" },
  depSearchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  depPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  depPickerDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  depDotDone: { backgroundColor: "#2e7d32" },
  depDotPending: { backgroundColor: "#f9a825" },
  depPickerTitle: { fontSize: 14, fontWeight: "600" },
  depPickerStatus: { fontSize: 12, marginTop: 2 },
  depEmpty: { textAlign: "center", marginTop: 24, fontSize: 14 },
  timelineCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 1,
  },
  timelineRow: { flexDirection: "row", alignItems: "flex-start" },
  timelineStop: { flex: 1, alignItems: "center" },
  timelineConnector: { height: 1.5, flex: 0.4, marginTop: 5 },
  timelineDot: { width: 11, height: 11, borderRadius: 5.5, marginBottom: 6 },
  timelineDotCreated: { backgroundColor: "#9e9e9e" },
  timelineDotDue: { backgroundColor: "#1976d2" },
  timelineDotOverdue: { backgroundColor: "#c62828" },
  timelineDotCompleted: { backgroundColor: "#2e7d32" },
  timelineDotEmpty: { backgroundColor: "transparent", borderWidth: 1.5 },
  timelineLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  timelineValue: { fontSize: 11, textAlign: "center" },
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
  metaLabel: { fontSize: 13, fontWeight: "500" },
  metaValue: { fontSize: 14, fontWeight: "600" },
  metaValueLink: { color: "#6200ee" },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: { fontSize: 13, fontWeight: "600" },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: { fontSize: 13, fontWeight: "600", color: "#555" },
  highPriority: { backgroundColor: "#ffebee" },
  mediumPriority: { backgroundColor: "#fff3e0" },
  lowPriority: { backgroundColor: "#e8f5e9" },
  highPriorityText: { color: "#c62828" },
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
  completeButton: { backgroundColor: "#2e7d32" },
  pendingButton: { backgroundColor: "#f9a825" },
  blockedButton: { backgroundColor: "#9e9e9e" },
  deleteButton: { backgroundColor: "#c62828" },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  subtasksHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  subtasksTitle: { fontSize: 18, fontWeight: "bold" },
  subtasksCount: { fontSize: 13 },
  addSubtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  subtaskInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  addButton: {
    backgroundColor: "#6200ee",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontSize: 20, lineHeight: 22 },
  subtaskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    elevation: 1,
  },
  subtaskCheckbox: { marginRight: 12 },
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
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  subtaskTitle: { flex: 1, fontSize: 15 },
  subtaskCompleted: { textDecorationLine: "line-through", opacity: 0.5 },
  subtaskEditButton: { paddingHorizontal: 8 },
  subtaskEditIcon: { color: "#6200ee", fontSize: 16 },
  subtaskDelete: { color: "#c62828", fontSize: 16, paddingHorizontal: 4 },
  subtaskEditInput: {
    flex: 1,
    borderBottomWidth: 1,
    fontSize: 15,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginRight: 8,
  },
  subtaskSaveLink: { color: "#6200ee", fontWeight: "bold", fontSize: 13 },
  subtaskCancelLink: { color: "#999", fontSize: 13 },
  emptySubtasks: { textAlign: "center", fontSize: 14, marginTop: 8 },
  notesSection: { marginTop: 8 },
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  notesTitle: { fontSize: 18, fontWeight: "bold" },
  notesSaveLink: { color: "#6200ee", fontWeight: "bold", fontSize: 13 },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  templateButton: {
    paddingHorizontal: 4,
  },
  templateButtonText: {
    fontSize: 14,
    color: "#6200ee",
    fontWeight: "600",
  },
  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  reactionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  reactionBtnActive: {
    borderColor: "#6200ee",
    backgroundColor: "#f3e8ff",
  },
  reactionEmoji: {
    fontSize: 20,
  },
  reactionClear: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionClearText: {
    color: "#999",
    fontSize: 14,
  },
  reactionDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reactionDisplayEmoji: {
    fontSize: 24,
  },
  reactionDisplayLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
  },
  activitySection: {
    marginTop: 24,
  },
  activityEmpty: {
    fontSize: 13,
    marginTop: 4,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6200ee",
    marginTop: 5,
    marginRight: 10,
  },
  activityText: {
    fontSize: 13,
    lineHeight: 18,
  },
  activityTime: {
    fontSize: 11,
    marginTop: 2,
  },
});
