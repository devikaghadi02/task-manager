import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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

type Template = {
  id: string;
  title: string;
  priority: string;
  category: string | null;
  template_subtasks: { id: string; title: string; position: number }[];
};

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

  // Template picker state
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

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

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("templates")
        .select("*, template_subtasks(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) setTemplates(data as Template[]);
    } catch (e) {
      console.log("Error fetching templates:", e);
    }
    setLoadingTemplates(false);
  };

  const openTemplatePicker = async () => {
    setTemplateSearch("");
    await fetchTemplates();
    setTemplateModalVisible(true);
  };

  const applyTemplate = (template: Template) => {
    // Pre-fill the form fields from the template
    setTitle(template.title);
    setCategory(template.category || "");
    setPriority(
      ["Low", "Medium", "High"].includes(template.priority)
        ? (template.priority as "Low" | "Medium" | "High")
        : "Medium",
    );
    setTemplateModalVisible(false);
  };

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

          // Find the template that matches current title to copy its subtasks
          // (if user applied a template before submitting)
          const matchedTemplate = templates.find(
            (t) => t.title === title.trim(),
          );
          if (
            matchedTemplate &&
            matchedTemplate.template_subtasks?.length > 0
          ) {
            const subtasksToInsert = matchedTemplate.template_subtasks
              .sort((a, b) => a.position - b.position)
              .map((s, i) => ({
                task_id: newTask.id,
                title: s.title,
                completed: false,
                position: i,
              }));

            await supabase.from("subtasks").insert(subtasksToInsert);
          }
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

  const filteredTemplates = templates.filter((t) =>
    t.title.toLowerCase().includes(templateSearch.toLowerCase()),
  );

  return (
    <>
      {/* Template picker modal */}
      <Modal
        visible={templateModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTemplateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Choose a Template
              </Text>
              <TouchableOpacity onPress={() => setTemplateModalVisible(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.templateSearch,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Search templates..."
              placeholderTextColor={colors.subtext}
              value={templateSearch}
              onChangeText={setTemplateSearch}
            />

            {loadingTemplates ? (
              <ActivityIndicator color="#6200ee" style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={filteredTemplates}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.templateRow,
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={() => applyTemplate(item)}
                  >
                    <View style={styles.templateRowLeft}>
                      <Text
                        style={[styles.templateTitle, { color: colors.text }]}
                      >
                        {item.title}
                      </Text>
                      <View style={styles.templateMeta}>
                        {item.category ? (
                          <View
                            style={[
                              styles.templateCategoryChip,
                              {
                                backgroundColor:
                                  getCategoryColor(item.category) + "22",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.templateCategoryText,
                                { color: getCategoryColor(item.category) },
                              ]}
                            >
                              {item.category}
                            </Text>
                          </View>
                        ) : null}
                        <Text
                          style={[
                            styles.templatePriority,
                            { color: colors.subtext },
                          ]}
                        >
                          {item.priority}
                        </Text>
                        {item.template_subtasks?.length > 0 && (
                          <Text
                            style={[
                              styles.templateSubtaskCount,
                              { color: colors.subtext },
                            ]}
                          >
                            · {item.template_subtasks.length} subtask
                            {item.template_subtasks.length > 1 ? "s" : ""}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.templateChevron,
                        { color: colors.subtext },
                      ]}
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text
                    style={[styles.templateEmpty, { color: colors.subtext }]}
                  >
                    No templates yet. Save a task as a template from its details
                    screen.
                  </Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

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
          {!isEditMode ? (
            <TouchableOpacity
              style={styles.templatePickerButton}
              onPress={openTemplatePicker}
            >
              <Text style={styles.templatePickerText}>Templates</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
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
          <Text style={[styles.label, { color: colors.subtext }]}>
            Priority
          </Text>
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
          <Text style={[styles.label, { color: colors.subtext }]}>
            Due Date
          </Text>
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
    </>
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
  templatePickerButton: {
    padding: 8,
  },
  templatePickerText: {
    fontSize: 15,
    color: "#6200ee",
    fontWeight: "600",
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
  // Modal styles
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  modalClose: {
    fontSize: 15,
    color: "#6200ee",
    fontWeight: "600",
  },
  templateSearch: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  templateRowLeft: {
    flex: 1,
  },
  templateTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  templateMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  templateCategoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
  },
  templateCategoryText: {
    fontSize: 11,
    fontWeight: "600",
  },
  templatePriority: {
    fontSize: 12,
  },
  templateSubtaskCount: {
    fontSize: 12,
    marginLeft: 4,
  },
  templateChevron: {
    fontSize: 22,
    fontWeight: "600",
  },
  templateEmpty: {
    textAlign: "center",
    marginTop: 32,
    fontSize: 14,
    paddingHorizontal: 16,
  },
});
