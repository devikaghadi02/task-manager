import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { scheduleTaskReminder } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { getCategoryColor } from "../lib/userHelper";

const SUGGESTED_CATEGORIES = [
  "Work",
  "Personal",
  "Shopping",
  "Fitness",
  "Education",
  "Urgent",
];

export default function CreateTaskScreen() {
  const params = useLocalSearchParams();
  const editingId = params.id ? String(params.id) : null;
  const isEditMode = editingId !== null;

  const [title, setTitle] = useState(params.title ? String(params.title) : "");
  const [category, setCategory] = useState(
    params.category ? String(params.category) : "",
  );
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">(
    params.priority &&
      ["Low", "Medium", "High"].includes(String(params.priority))
      ? (String(params.priority) as "Low" | "Medium" | "High")
      : "Medium",
  );
  const [dueDate, setDueDate] = useState(
    params.dueDate && !isNaN(new Date(String(params.dueDate)).getTime())
      ? new Date(String(params.dueDate))
      : new Date(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { colors } = useTheme();

  // Re-sync form fields whenever the params change. Without this, if the
  // create-task screen is already mounted from a previous visit, useState's
  // initial values won't update and you'd see stale data (e.g. "New Task"
  // label or an old/garbled due date when opening Edit for a different task).
  useEffect(() => {
    setTitle(params.title ? String(params.title) : "");
    setCategory(params.category ? String(params.category) : "");
    setPriority(
      params.priority &&
        ["Low", "Medium", "High"].includes(String(params.priority))
        ? (String(params.priority) as "Low" | "Medium" | "High")
        : "Medium",
    );
    const parsedDate =
      params.dueDate && String(params.dueDate) !== "undefined"
        ? new Date(String(params.dueDate))
        : new Date();
    setDueDate(!isNaN(parsedDate.getTime()) ? parsedDate : new Date());
    setError("");
  }, [
    params.id,
    params.title,
    params.category,
    params.priority,
    params.dueDate,
  ]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) setDueDate(selectedDate);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isEditMode) {
        const { error: updateError } = await supabase
          .from("tasks")
          .update({
            title: title.trim(),
            category: category.trim() || null,
            priority,
            due_date: dueDate.toISOString(),
          })
          .eq("id", editingId);

        if (updateError) throw updateError;
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("You must be logged in to create a task");
          setLoading(false);
          return;
        }

        const { data: newTask, error: insertError } = await supabase
          .from("tasks")
          .insert({
            user_id: user.id,
            title: title.trim(),
            category: category.trim() || null,
            priority,
            due_date: dueDate.toISOString(),
          })
          .select()
          .single();

        if (insertError) throw insertError;

        if (newTask) {
          await scheduleTaskReminder(newTask.id, newTask.title, dueDate);
        }
      }
      router.back();
    } catch (err: any) {
      setError(
        err.message || `Failed to ${isEditMode ? "update" : "create"} task`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isEditMode ? "Edit Task" : "New Task"}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.subtext }]}>Title</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="What needs to be done?"
          placeholderTextColor={colors.subtext}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.subtext }]}>
          Category (Optional)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="e.g. Work, Personal"
          placeholderTextColor={colors.subtext}
          value={category}
          onChangeText={setCategory}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionsRow}
        >
          {SUGGESTED_CATEGORIES.map((cat) => {
            const isSelected = category.toLowerCase() === cat.toLowerCase();
            const catColor = getCategoryColor(cat);
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.suggestionChip,
                  { borderColor: catColor },
                  isSelected && { backgroundColor: catColor },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.suggestionText,
                    { color: isSelected ? "#fff" : catColor },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.subtext }]}>Priority</Text>
        <View style={styles.priorityContainer}>
          {(["Low", "Medium", "High"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.priorityButton,
                { borderColor: colors.border, backgroundColor: colors.card },
                priority === p && styles.prioritySelected,
              ]}
              onPress={() => setPriority(p)}
            >
              <Text
                style={[
                  styles.priorityText,
                  { color: colors.text },
                  priority === p && styles.priorityTextSelected,
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.subtext }]}>Due Date</Text>
        {Platform.OS === "android" ? (
          <TouchableOpacity
            style={[
              styles.dateButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={[styles.dateText, { color: colors.text }]}>
              {dueDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        ) : null}

        {(showDatePicker || Platform.OS === "ios") && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            style={
              Platform.OS === "ios" ? { alignSelf: "flex-start" } : undefined
            }
          />
        )}
      </View>

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            {isEditMode ? "Save Changes" : "Create Task"}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: "#6200ee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  errorText: {
    color: "#d32f2f",
    marginBottom: 16,
    textAlign: "center",
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  suggestionsRow: {
    marginTop: 4,
  },
  suggestionChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  priorityContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  prioritySelected: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  priorityText: {
    fontWeight: "600",
  },
  priorityTextSelected: {
    color: "#fff",
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateText: {
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: "#6200ee",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
