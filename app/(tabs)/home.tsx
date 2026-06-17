import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SwipeableTask from "../../components/SwipeableTask";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/ThemeContext";
import { getCategoryColor, getUserDisplayName } from "../../lib/userHelper";

type Task = {
  id: string;
  title: string;
  completed: boolean;
  user_id: string;
  due_date: string | null;
  priority: string;
  category: string | null;
};

type Section = {
  title: string;
  userId: string;
  data: Task[];
};

type Profile = {
  id: string;
  email: string;
  full_name: string;
};

function FilterChips({
  options,
  selected,
  onSelect,
  colorize,
  colors,
}: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  colorize?: boolean;
  colors: any;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsRow}
      contentContainerStyle={styles.chipsContent}
    >
      {options.map((opt) => {
        const isSelected = selected === opt;
        const chipColor =
          colorize && opt !== "All" ? getCategoryColor(opt) : "#6200ee";
        return (
          <TouchableOpacity
            key={opt}
            style={[
              styles.chip,
              isSelected && {
                backgroundColor: chipColor,
                borderColor: chipColor,
              },
              !isSelected && { borderColor: colors.border },
            ]}
            onPress={() => onSelect(opt)}
          >
            <Text
              style={[
                styles.chipText,
                isSelected && styles.chipTextSelected,
                !isSelected && { color: colors.subtext },
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const { colors } = useTheme();

  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const admin = user.email === "admin@test.com";
        setIsAdmin(admin);
        fetchTasks(admin);
      } else {
        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
    }
  };

  const fetchTasks = async (admin: boolean) => {
    try {
      if (admin) {
        const { data: tasksData, error: fetchError } = await supabase
          .from("tasks")
          .select("*");
        if (fetchError) throw fetchError;

        const { data: profilesData } = await supabase
          .from("profiles")
          .select("*");

        const profileMap: { [key: string]: Profile } = {};
        if (profilesData) {
          (profilesData as Profile[]).forEach((profile) => {
            profileMap[profile.id] = profile;
          });
        }

        const grouped: { [key: string]: Task[] } = {};
        (tasksData as Task[]).forEach((task) => {
          if (!grouped[task.user_id]) grouped[task.user_id] = [];
          grouped[task.user_id].push(task);
        });

        const sectionData: Section[] = Object.keys(grouped).map((userId) => ({
          title: getUserDisplayName(userId, profileMap[userId]),
          userId,
          data: grouped[userId],
        }));

        setSections(sectionData);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data, error: fetchError } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (fetchError) throw fetchError;
          setTasks(data as Task[]);
        }
      }
      setLoading(false);
    } catch (err) {
      setError("Something went wrong. Try again!");
      setLoading(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await supabase.from("tasks").delete().eq("id", taskId);
      if (isAdmin) {
        setSections(
          sections
            .map((s) => ({
              ...s,
              data: s.data.filter((t) => t.id !== taskId),
            }))
            .filter((s) => s.data.length > 0),
        );
      } else {
        setTasks(tasks.filter((t) => t.id !== taskId));
      }
    } catch (e) {
      console.log("Error deleting task:", e);
    }
  };

  const toggleComplete = async (task: Task) => {
    try {
      await supabase
        .from("tasks")
        .update({ completed: !task.completed })
        .eq("id", task.id);

      if (isAdmin) {
        setSections(
          sections.map((s) => ({
            ...s,
            data: s.data.map((t) =>
              t.id === task.id ? { ...t, completed: !t.completed } : t,
            ),
          })),
        );
      } else {
        setTasks(
          tasks.map((t) =>
            t.id === task.id ? { ...t, completed: !t.completed } : t,
          ),
        );
      }
    } catch (e) {
      console.log("Error toggling task:", e);
    }
  };

  const categories = useMemo(() => {
    const allTasks = isAdmin ? sections.flatMap((s) => s.data) : tasks;
    const cats = allTasks
      .map((t) => t.category)
      .filter((c): c is string => !!c);
    return ["All", ...Array.from(new Set(cats))];
  }, [tasks, sections, isAdmin]);

  const filterTask = useCallback(
    (task: Task) => {
      if (
        searchText &&
        !task.title.toLowerCase().includes(searchText.toLowerCase())
      )
        return false;
      if (selectedStatus === "Completed" && !task.completed) return false;
      if (selectedStatus === "Pending" && task.completed) return false;
      if (selectedPriority !== "All" && task.priority !== selectedPriority)
        return false;
      if (selectedCategory !== "All" && task.category !== selectedCategory)
        return false;
      return true;
    },
    [searchText, selectedStatus, selectedPriority, selectedCategory],
  );

  const filteredTasks = useMemo(
    () => tasks.filter(filterTask),
    [tasks, filterTask],
  );

  const filteredSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          data: section.data.filter(filterTask),
        }))
        .filter((section) => section.data.length > 0),
    [sections, filterTask],
  );

  const hasActiveFilters =
    selectedStatus !== "All" ||
    selectedPriority !== "All" ||
    selectedCategory !== "All";

  const SearchAndFilters = (
    <>
      <View style={styles.searchRow}>
        <TextInput
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.card,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Search tasks..."
          placeholderTextColor={colors.subtext}
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.filterToggle,
            { borderColor: colors.border },
            hasActiveFilters && styles.filterToggleActive,
          ]}
          onPress={() => setFiltersOpen(!filtersOpen)}
        >
          <Text
            style={[
              styles.filterToggleText,
              hasActiveFilters && styles.filterToggleTextActive,
            ]}
          >
            {filtersOpen ? "Hide" : "Filters"}
          </Text>
        </TouchableOpacity>
      </View>

      {filtersOpen && (
        <>
          <FilterChips
            options={["All", "Pending", "Completed"]}
            selected={selectedStatus}
            onSelect={setSelectedStatus}
            colors={colors}
          />
          <FilterChips
            options={["All", "High", "Medium", "Low"]}
            selected={selectedPriority}
            onSelect={setSelectedPriority}
            colors={colors}
          />
          <FilterChips
            options={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            colorize
            colors={colors}
          />
        </>
      )}
    </>
  );

  const TaskCard = ({ item }: { item: Task }) => (
    <SwipeableTask
      onDelete={() => deleteTask(item.id)}
      onToggleComplete={() => toggleComplete(item)}
      isCompleted={item.completed}
    >
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() =>
          router.push({
            pathname: "/details",
            params: {
              id: item.id,
              title: item.title,
              completed: String(item.completed),
              userId: item.user_id,
              dueDate: item.due_date || "",
              priority: item.priority,
              category: item.category || "",
            },
          })
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
            <Text
              style={[styles.taskTitle, { color: colors.text }]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              {item.due_date && (
                <Text style={[styles.taskMeta, { color: colors.subtext }]}>
                  Due: {new Date(item.due_date).toLocaleDateString()}
                </Text>
              )}
              {item.category && (
                <View
                  style={[
                    styles.categoryChip,
                    { backgroundColor: getCategoryColor(item.category) + "22" },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: getCategoryColor(item.category) },
                    ]}
                  >
                    {item.category}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {item.priority && (
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
              <Text
                style={[
                  styles.priorityText,
                  item.priority === "High" ? styles.highPriorityText : null,
                ]}
              >
                {item.priority}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </SwipeableTask>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={[styles.loadingText, { color: colors.subtext }]}>
          Loading tasks...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Tasks</Text>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        </View>

        {SearchAndFilters}

        <SectionList
          sections={filteredSections}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="always"
          renderSectionHeader={({ section }) => (
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: colors.background },
              ]}
            >
              <View style={styles.sectionLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {section.title.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {section.title}
                </Text>
              </View>
              <Text style={[styles.taskCount, { color: colors.subtext }]}>
                {section.data.length} tasks
              </Text>
            </View>
          )}
          renderItem={({ item }) => <TaskCard item={item} />}
          SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              No tasks match your filters
            </Text>
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Tasks</Text>
        <View style={styles.userBadge}>
          <Text style={styles.userBadgeText}>User</Text>
        </View>
      </View>

      {SearchAndFilters}

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="always"
        renderItem={({ item }) => <TaskCard item={item} />}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            No tasks match your filters
          </Text>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/create-task")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  searchBar: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 8,
  },
  filterToggle: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterToggleActive: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6200ee",
  },
  filterToggleTextActive: {
    color: "#fff",
  },
  chipsRow: {
    marginBottom: 6,
    flexGrow: 0,
  },
  chipsContent: {
    alignItems: "center",
    paddingRight: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    alignSelf: "flex-start",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: "#fff",
    fontWeight: "bold",
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
  },
  taskCount: {
    fontSize: 12,
  },
  card: {
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
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
  },
  taskMeta: {
    fontSize: 12,
    marginRight: 6,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: "600",
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
  highPriorityText: {
    color: "#c62828",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    color: "red",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    fontSize: 32,
    color: "#fff",
    lineHeight: 34,
  },
});
