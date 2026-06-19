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
import ProgressRing from "../../components/ProgressRing";
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
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "created">(
    "dueDate",
  );

  // Overall completion stats (ALL tasks — completed AND pending), used
  // only to drive the header progress ring. Kept separate from `tasks` /
  // `sections`, which now only ever hold PENDING tasks for the list.
  const [overallStats, setOverallStats] = useState({ total: 0, completed: 0 });

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
        fetchOverallStats(admin);
      } else {
        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
    }
  };

  // Lightweight query — only pulls the `completed` column, across ALL
  // tasks (no completed filter here, unlike fetchTasks below). This is
  // what feeds the header progress ring's real percentage.
  const fetchOverallStats = async (admin: boolean) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const query = supabase.from("tasks").select("completed");
      const { data, error } = admin
        ? await query
        : await query.eq("user_id", user.id);

      if (error) throw error;
      if (data) {
        const completed = data.filter((t) => t.completed).length;
        setOverallStats({ total: data.length, completed });
      }
    } catch (e) {
      console.log("Error fetching overall stats:", e);
    }
  };

  // Home only ever shows PENDING tasks (.eq("completed", false)).
  // Completed tasks move to the Saved screen instead.
  const fetchTasks = async (admin: boolean) => {
    try {
      if (admin) {
        const { data: tasksData, error: fetchError } = await supabase
          .from("tasks")
          .select("*")
          .eq("completed", false);
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
            .eq("completed", false)
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
      fetchOverallStats(isAdmin);
    } catch (e) {
      console.log("Error deleting task:", e);
    }
  };

  // When a task is marked complete from Home, it must disappear from the
  // visible list immediately — Home only loads pending tasks, so we
  // remove it from local state outright once the Supabase update succeeds.
  const toggleComplete = async (task: Task) => {
    try {
      const nowCompleted = !task.completed;
      await supabase
        .from("tasks")
        .update({
          completed: nowCompleted,
          completed_at: nowCompleted ? new Date().toISOString() : null,
        })
        .eq("id", task.id);

      if (nowCompleted) {
        if (isAdmin) {
          setSections(
            sections
              .map((s) => ({
                ...s,
                data: s.data.filter((t) => t.id !== task.id),
              }))
              .filter((s) => s.data.length > 0),
          );
        } else {
          setTasks(tasks.filter((t) => t.id !== task.id));
        }
      } else {
        if (isAdmin) {
          setSections(
            sections.map((s) => ({
              ...s,
              data: s.data.map((t) =>
                t.id === task.id ? { ...t, completed: false } : t,
              ),
            })),
          );
        } else {
          setTasks(
            tasks.map((t) =>
              t.id === task.id ? { ...t, completed: false } : t,
            ),
          );
        }
      }
      // Keep the header progress ring in sync with the real change
      fetchOverallStats(isAdmin);
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

  // Derived from overallStats (ALL tasks, completed + pending) instead of
  // the pending-only `tasks`/`sections` state — gives the ring a true
  // overall completion percentage matching what Profile shows.
  const progressStats = useMemo(() => {
    const percentage =
      overallStats.total > 0
        ? (overallStats.completed / overallStats.total) * 100
        : 0;
    return {
      total: overallStats.total,
      completed: overallStats.completed,
      percentage,
    };
  }, [overallStats]);

  const dueSoonTasks = useMemo(() => {
    const allTasks = isAdmin ? sections.flatMap((s) => s.data) : tasks;
    const now = Date.now();
    const in48Hours = now + 48 * 60 * 60 * 1000;

    return allTasks.filter((t) => {
      if (!t.due_date || t.completed) return false;
      const dueTime = new Date(t.due_date).getTime();
      if (isNaN(dueTime)) return false;
      return dueTime >= now && dueTime <= in48Hours;
    });
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

  const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

  const sortTasks = useCallback(
    (taskList: Task[]) => {
      const copy = [...taskList];
      if (sortBy === "dueDate") {
        copy.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return (
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
          );
        });
      } else if (sortBy === "priority") {
        copy.sort(
          (a, b) =>
            (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3),
        );
      }
      // "created" needs no re-sort — tasks already arrive newest-first from the query
      return copy;
    },
    [sortBy],
  );

  const filteredTasks = useMemo(
    () => sortTasks(tasks.filter(filterTask)),
    [tasks, filterTask, sortTasks],
  );

  const filteredSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          data: sortTasks(section.data.filter(filterTask)),
        }))
        .filter((section) => section.data.length > 0),
    [sections, filterTask, sortTasks],
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
        <TouchableOpacity
          style={[
            styles.filterToggle,
            { borderColor: colors.border, marginLeft: 8 },
          ]}
          onPress={() => {
            const order: Array<"dueDate" | "priority" | "created"> = [
              "dueDate",
              "priority",
              "created",
            ];
            const nextIndex = (order.indexOf(sortBy) + 1) % order.length;
            setSortBy(order[nextIndex]);
          }}
        >
          <Text style={styles.filterToggleText}>
            Sort:{" "}
            {sortBy === "dueDate"
              ? "Due"
              : sortBy === "priority"
                ? "Priority"
                : "New"}
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

  const DueSoonBanner = () =>
    dueSoonTasks.length > 0 ? (
      <View
        style={[
          styles.dueSoonBanner,
          { backgroundColor: colors.card, borderColor: "#f9a825" },
        ]}
      >
        <Text style={styles.dueSoonTitle}>
          ⏰ {dueSoonTasks.length} task{dueSoonTasks.length > 1 ? "s" : ""} due
          soon
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {dueSoonTasks.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.dueSoonChip}
              onPress={() =>
                router.push({
                  pathname: "/details",
                  params: {
                    id: t.id,
                    title: t.title,
                    completed: String(t.completed),
                    userId: t.user_id,
                    dueDate: t.due_date || "",
                    priority: t.priority,
                    category: t.category || "",
                  },
                })
              }
            >
              <Text style={styles.dueSoonChipText} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={styles.dueSoonChipDate}>
                {new Date(t.due_date!).toLocaleDateString([], {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    ) : null;

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
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.progressRingWrap}
              onPress={() => router.push("/profile")}
            >
              <ProgressRing
                percentage={progressStats.percentage}
                size={36}
                strokeWidth={3.5}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.timelineButton}
              onPress={() => router.push("/timeline")}
            >
              <Text style={styles.timelineButtonText}>Timeline</Text>
            </TouchableOpacity>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          </View>
        </View>

        {SearchAndFilters}
        <DueSoonBanner />

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
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.progressRingWrap}
            onPress={() => router.push("/profile")}
          >
            <ProgressRing
              percentage={progressStats.percentage}
              size={36}
              strokeWidth={3.5}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.timelineButton}
            onPress={() => router.push("/timeline")}
          >
            <Text style={styles.timelineButtonText}>Timeline</Text>
          </TouchableOpacity>
          <View style={styles.userBadge}>
            <Text style={styles.userBadgeText}>User</Text>
          </View>
        </View>
      </View>

      {SearchAndFilters}
      <DueSoonBanner />

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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressRingWrap: {
    marginRight: 10,
  },
  timelineButton: {
    borderWidth: 1,
    borderColor: "#6200ee",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
  },
  timelineButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6200ee",
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
  dueSoonBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  dueSoonTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#e65100",
    marginBottom: 8,
  },
  dueSoonChip: {
    backgroundColor: "#fff3e0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    maxWidth: 140,
  },
  dueSoonChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "e65100",
  },
  dueSoonChipDate: {
    fontSize: 10,
    color: "e65100",
    marginTop: 2,
  },
});
