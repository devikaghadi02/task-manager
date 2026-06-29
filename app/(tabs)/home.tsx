import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  ScrollView,
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
  task_order?: number;
  reaction?: string | null;
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
let overdueAlertShownGlobal = false;
export default function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const { colors } = useTheme();

  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Pending");
  const [selectedPriority, setSelectedPriority] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "created">(
    "dueDate",
  );
  const overdueAlertShown = useRef(overdueAlertShownGlobal);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const [overallStats, setOverallStats] = useState({ total: 0, completed: 0 });

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [quickAddText, setQuickAddText] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const sidebarAnim = useRef(new Animated.Value(-280)).current;

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
        setUserEmail(user.email || "");
        fetchTasks(admin);
        fetchOverallStats(admin);
        checkOverdueTasks(admin);

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .single();
        setUserName(profile?.full_name || user.email?.split("@")[0] || "User");
      } else {
        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
    }
  };

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.timing(sidebarAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  };

  const closeSidebar = () => {
    Animated.timing(sidebarAnim, {
      toValue: -280,
      duration: 240,
      useNativeDriver: true,
    }).start(() => setSidebarOpen(false));
  };

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

  const checkOverdueTasks = async (admin: boolean) => {
    if (overdueAlertShown.current) return;

    // Only show once per login session — persisted via AsyncStorage
    const key = "overdueAlertShown";
    const already = await AsyncStorage.getItem(key);
    if (already === "true") {
      overdueAlertShown.current = true;
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date().toISOString();
      const query = supabase
        .from("tasks")
        .select("id", { count: "exact" })
        .eq("completed", false)
        .lt("due_date", now);

      const { count, error } = admin
        ? await query
        : await query.eq("user_id", user.id);

      if (error) throw error;

      if (count && count > 0) {
        overdueAlertShown.current = true;
        await AsyncStorage.setItem(key, "true");
        Alert.alert(
          "Overdue Tasks",
          `You have ${count} overdue task${count > 1 ? "s" : ""}! Check them soon.`,
          [
            {
              text: "View Overdue",
              onPress: () => {
                setFiltersOpen(true);
                setSelectedStatus("Pending");
              },
            },
            { text: "Dismiss", style: "cancel" },
          ],
        );
      }
    } catch (e) {
      console.log("Error checking overdue tasks:", e);
    }
  };

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

      if (isAdmin) {
        setSections(
          sections.map((s) => ({
            ...s,
            data: s.data.map((t) =>
              t.id === task.id ? { ...t, completed: nowCompleted } : t,
            ),
          })),
        );
      } else {
        setTasks(
          tasks.map((t) =>
            t.id === task.id ? { ...t, completed: nowCompleted } : t,
          ),
        );
      }
      fetchOverallStats(isAdmin);
    } catch (e) {
      console.log("Error toggling task:", e);
    }
  };

  const reorderTasks = async (reorderedTasks: Task[]) => {
    try {
      for (let i = 0; i < reorderedTasks.length; i++) {
        await supabase
          .from("tasks")
          .update({ task_order: i })
          .eq("id", reorderedTasks[i].id);
      }
      if (!isAdmin) {
        setTasks(reorderedTasks);
      }
    } catch (e) {
      console.log("Error reordering tasks:", e);
    }
  };

  const reorderSectionTasks = async (
    userId: string,
    reorderedTasks: Task[],
  ) => {
    try {
      for (let i = 0; i < reorderedTasks.length; i++) {
        await supabase
          .from("tasks")
          .update({ task_order: i })
          .eq("id", reorderedTasks[i].id);
      }
      setSections(
        sections.map((s) =>
          s.userId === userId ? { ...s, data: reorderedTasks } : s,
        ),
      );
    } catch (e) {
      console.log("Error reordering section tasks:", e);
    }
  };

  const enterSelectionMode = (taskId: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([taskId]));
  };

  const toggleSelection = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const bulkDelete = async () => {
    try {
      await supabase.from("tasks").delete().in("id", Array.from(selectedIds));
      if (isAdmin) {
        setSections(
          sections
            .map((s) => ({
              ...s,
              data: s.data.filter((t) => !selectedIds.has(t.id)),
            }))
            .filter((s) => s.data.length > 0),
        );
      } else {
        setTasks(tasks.filter((t) => !selectedIds.has(t.id)));
      }
      fetchOverallStats(isAdmin);
      exitSelectionMode();
    } catch (e) {
      console.log("Error bulk deleting:", e);
    }
  };

  const bulkComplete = async () => {
    try {
      await supabase
        .from("tasks")
        .update({ completed: true, completed_at: new Date().toISOString() })
        .in("id", Array.from(selectedIds));

      if (isAdmin) {
        setSections(
          sections
            .map((s) => ({
              ...s,
              data: s.data.filter((t) => !selectedIds.has(t.id)),
            }))
            .filter((s) => s.data.length > 0),
        );
      } else {
        setTasks(tasks.filter((t) => !selectedIds.has(t.id)));
      }
      fetchOverallStats(isAdmin);
      exitSelectionMode();
    } catch (e) {
      console.log("Error bulk completing:", e);
    }
  };

  const quickAddTask = async () => {
    if (!quickAddText.trim()) return;
    setQuickAdding(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: quickAddText.trim(),
          user_id: user.id,
          completed: false,
          priority: "Medium",
        })
        .select()
        .single();

      if (!error && data) {
        setTasks((prev) => [data as Task, ...prev]);
        setQuickAddText("");
        fetchOverallStats(isAdmin);
      }
    } catch (e) {
      console.log("Error quick-adding task:", e);
    }
    setQuickAdding(false);
  };

  const categories = useMemo(() => {
    const allTasks = isAdmin ? sections.flatMap((s) => s.data) : tasks;
    const cats = allTasks
      .map((t) => t.category)
      .filter((c): c is string => !!c);
    return ["All", ...Array.from(new Set(cats))];
  }, [tasks, sections, isAdmin]);

  const userOptions = useMemo(() => {
    if (!isAdmin) return ["All"];
    return ["All", ...sections.map((s) => s.title)];
  }, [sections, isAdmin]);

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
    (task: Task, sectionTitle?: string) => {
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
      if (
        selectedUser !== "All" &&
        sectionTitle &&
        sectionTitle !== selectedUser
      )
        return false;

      if (fromDate || toDate) {
        if (!task.due_date) return false;
        const due = new Date(task.due_date).getTime();
        if (fromDate) {
          const from = new Date(fromDate);
          from.setHours(0, 0, 0, 0);
          if (due < from.getTime()) return false;
        }
        if (toDate) {
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999);
          if (due > to.getTime()) return false;
        }
      }
      return true;
    },
    [
      searchText,
      selectedStatus,
      selectedPriority,
      selectedCategory,
      selectedUser,
      fromDate,
      toDate,
    ],
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
      return copy;
    },
    [sortBy],
  );

  const filteredTasks = useMemo(
    () => sortTasks(tasks.filter((t) => filterTask(t))),
    [tasks, filterTask, sortTasks],
  );

  const addToSearchHistory = (text: string) => {
    if (!text.trim()) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter(
        (s) => s.toLowerCase() !== text.toLowerCase(),
      );
      return [text.trim(), ...filtered].slice(0, 5);
    });
  };

  const removeFromHistory = (term: string) => {
    setSearchHistory((prev) => prev.filter((s) => s !== term));
  };

  const filteredSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          data: sortTasks(
            section.data.filter((t) => filterTask(t, section.title)),
          ),
        }))
        .filter((section) => section.data.length > 0),
    [sections, filterTask, sortTasks],
  );

  const hasActiveFilters =
    selectedStatus !== "All" ||
    selectedPriority !== "All" ||
    selectedCategory !== "All" ||
    fromDate !== null ||
    toDate !== null ||
    selectedUser !== "All";

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
          onSubmitEditing={() => addToSearchHistory(searchText)}
          onEndEditing={() => addToSearchHistory(searchText)}
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

      {searchHistory.length > 0 && searchText === "" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.historyRow}
          contentContainerStyle={{ alignItems: "center", paddingRight: 8 }}
        >
          {searchHistory.map((term) => (
            <View
              key={term}
              style={[
                styles.historyChip,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity onPress={() => setSearchText(term)}>
                <Text style={[styles.historyChipText, { color: colors.text }]}>
                  {term}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeFromHistory(term)}
                style={styles.historyChipClose}
              >
                <Text
                  style={[
                    styles.historyChipCloseText,
                    { color: colors.subtext },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

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
          <View style={styles.dateRangeRow}>
            <Text style={[styles.dateRangeLabel, { color: colors.subtext }]}>
              Due from
            </Text>
            <TouchableOpacity
              style={[
                styles.dateBtn,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
              onPress={() => setShowFromPicker(true)}
            >
              <Text
                style={[
                  styles.dateBtnText,
                  { color: fromDate ? colors.text : colors.subtext },
                ]}
              >
                {fromDate ? fromDate.toLocaleDateString() : "Start date"}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.dateRangeLabel, { color: colors.subtext }]}>
              to
            </Text>
            <TouchableOpacity
              style={[
                styles.dateBtn,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
              onPress={() => setShowToPicker(true)}
            >
              <Text
                style={[
                  styles.dateBtnText,
                  { color: toDate ? colors.text : colors.subtext },
                ]}
              >
                {toDate ? toDate.toLocaleDateString() : "End date"}
              </Text>
            </TouchableOpacity>
            {(fromDate || toDate) && (
              <TouchableOpacity
                onPress={() => {
                  setFromDate(null);
                  setToDate(null);
                }}
                style={styles.dateClear}
              >
                <Text style={styles.dateClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {showFromPicker && (
            <DateTimePicker
              value={fromDate || new Date()}
              mode="date"
              display="default"
              onChange={(_, date) => {
                setShowFromPicker(false);
                if (date) setFromDate(date);
              }}
            />
          )}
          {showToPicker && (
            <DateTimePicker
              value={toDate || new Date()}
              mode="date"
              display="default"
              onChange={(_, date) => {
                setShowToPicker(false);
                if (date) setToDate(date);
              }}
            />
          )}

          {isAdmin && (
            <TouchableOpacity
              style={[
                styles.userPickerBtn,
                {
                  borderColor:
                    selectedUser !== "All" ? "#6200ee" : colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              onPress={() => setUserModalVisible(true)}
            >
              <Text
                style={[
                  styles.userPickerText,
                  {
                    color: selectedUser !== "All" ? "#6200ee" : colors.subtext,
                  },
                ]}
              >
                👤 {selectedUser === "All" ? "All users" : selectedUser}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>▾</Text>
            </TouchableOpacity>
          )}
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

  const SelectionBar = () =>
    selectionMode ? (
      <View style={styles.selectionBar}>
        <Text style={styles.selectionCount}>{selectedIds.size} selected</Text>
        <View style={styles.selectionActions}>
          <TouchableOpacity
            style={styles.selectionActionButton}
            onPress={bulkComplete}
            disabled={selectedIds.size === 0}
          >
            <Text style={styles.selectionActionText}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.selectionActionButton}
            onPress={() => {
              Alert.alert(
                "Delete Tasks",
                `Delete ${selectedIds.size} task${selectedIds.size > 1 ? "s" : ""}?`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: bulkDelete },
                ],
              );
            }}
            disabled={selectedIds.size === 0}
          >
            <Text style={styles.selectionActionText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.selectionActionButton}
            onPress={exitSelectionMode}
          >
            <Text style={styles.selectionActionText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    ) : null;

  const UserPickerModal = () => (
    <Modal
      visible={userModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setUserModalVisible(false)}
    >
      <View style={styles.userModalOverlay}>
        <View
          style={[
            styles.userModalSheet,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.userModalHeader}>
            <Text style={[styles.userModalTitle, { color: colors.text }]}>
              Select User
            </Text>
            <TouchableOpacity onPress={() => setUserModalVisible(false)}>
              <Text style={styles.userModalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={["All", ...sections.map((s) => s.title)]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.userModalRow,
                  { borderBottomColor: colors.border },
                  selectedUser === item && styles.userModalRowActive,
                ]}
                onPress={() => {
                  setSelectedUser(item);
                  setUserModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.userModalRowText,
                    {
                      color: selectedUser === item ? "#6200ee" : colors.text,
                    },
                  ]}
                >
                  {item === "All" ? "All users" : item}
                </Text>
                {selectedUser === item && (
                  <Text style={{ color: "#6200ee", fontWeight: "bold" }}>
                    ✓
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  const Sidebar = () => (
    <Modal
      visible={sidebarOpen}
      transparent
      animationType="none"
      onRequestClose={closeSidebar}
    >
      <TouchableOpacity
        style={styles.sidebarOverlay}
        activeOpacity={1}
        onPress={closeSidebar}
      >
        <Animated.View
          style={[
            styles.sidebar,
            {
              backgroundColor: colors.card,
              transform: [{ translateX: sidebarAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.sidebarHeader}>
              <View style={styles.sidebarAvatar}>
                <Text style={styles.sidebarAvatarText}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text
                style={[styles.sidebarName, { color: colors.text }]}
                numberOfLines={1}
              >
                {userName}
              </Text>
              <Text
                style={[styles.sidebarEmail, { color: colors.subtext }]}
                numberOfLines={1}
              >
                {userEmail}
              </Text>
              {isAdmin && (
                <View style={styles.sidebarAdminBadge}>
                  <Text style={styles.sidebarAdminText}>Admin</Text>
                </View>
              )}
            </View>

            <View
              style={[
                styles.sidebarDivider,
                { backgroundColor: colors.border },
              ]}
            />

            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={() => {
                closeSidebar();
                router.push("/statistics");
              }}
            >
              <Text style={styles.sidebarItemIcon}>📊</Text>
              <Text style={[styles.sidebarItemText, { color: colors.text }]}>
                Statistics
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={() => {
                closeSidebar();
                router.push("/profile");
              }}
            >
              <Text style={styles.sidebarItemIcon}>👤</Text>
              <Text style={[styles.sidebarItemText, { color: colors.text }]}>
                Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sidebarItem} onPress={closeSidebar}>
              <Text style={styles.sidebarItemIcon}>✓</Text>
              <Text style={[styles.sidebarItemText, { color: colors.text }]}>
                Task List
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.sidebarDivider,
                { backgroundColor: colors.border },
              ]}
            />

            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={() => {
                closeSidebar();
                router.push("/(tabs)/settings");
              }}
            >
              <Text style={styles.sidebarItemIcon}>⚙️</Text>
              <Text style={[styles.sidebarItemText, { color: colors.text }]}>
                Settings
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );

  const TaskCard = ({ item }: { item: Task }) => {
    const isSelected = selectedIds.has(item.id);

    const cardContent = (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.card },
          isSelected && styles.cardSelected,
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleSelection(item.id);
          } else {
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
            });
          }
        }}
        onLongPress={() => {
          if (!selectionMode) enterSelectionMode(item.id);
        }}
      >
        <View style={styles.cardRow}>
          {selectionMode && (
            <View
              style={[
                styles.selectCircle,
                isSelected && styles.selectCircleChecked,
              ]}
            >
              {isSelected && <Text style={styles.selectCheckmark}>✓</Text>}
            </View>
          )}
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
          {item.reaction && (
            <Text style={styles.reactionBadge}>{item.reaction}</Text>
          )}
        </View>
      </TouchableOpacity>
    );

    if (selectionMode) {
      return cardContent;
    }

    return (
      <SwipeableTask
        onDelete={() => deleteTask(item.id)}
        onToggleComplete={() => toggleComplete(item)}
        isCompleted={item.completed}
      >
        {cardContent}
      </SwipeableTask>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={"#6200ee"} />
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
        <Sidebar />
        <UserPickerModal />
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <TouchableOpacity onPress={openSidebar} style={styles.hamburger}>
              <Text style={[styles.hamburgerText, { color: colors.text }]}>
                ☰
              </Text>
              {(fromDate !== null || toDate !== null) && (
                <View style={styles.hamburgerBadge} />
              )}
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Tasks</Text>
          </View>
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
            <TouchableOpacity
              style={styles.timelineButton}
              onPress={() =>
                selectionMode ? exitSelectionMode() : setSelectionMode(true)
              }
            >
              <Text style={styles.timelineButtonText}>
                {selectionMode ? "Done" : "Select"}
              </Text>
            </TouchableOpacity>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          </View>
        </View>

        {SearchAndFilters}
        <SelectionBar />
        <DueSoonBanner />

        <FlatList
          data={filteredSections}
          keyExtractor={(section) => section.userId}
          keyboardShouldPersistTaps="always"
          style={{ flex: 1 }}
          renderItem={({ item: section }) => (
            <View>
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
              {section.data.map((task) => (
                <TaskCard key={task.id} item={task} />
              ))}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Sidebar />
      <UserPickerModal />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={openSidebar} style={styles.hamburger}>
            <Text style={[styles.hamburgerText, { color: colors.text }]}>
              ☰
            </Text>
            {(fromDate !== null || toDate !== null) && (
              <View style={styles.hamburgerBadge} />
            )}
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>My Tasks</Text>
        </View>
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
      <SelectionBar />
      <DueSoonBanner />

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="always"
        style={{ flex: 1 }}
        renderItem={({ item }) => <TaskCard item={item} />}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            No tasks match your filters
          </Text>
        }
      />

      {quickAddVisible && (
        <View
          style={[
            styles.quickAddBar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TextInput
            style={[styles.quickAddInput, { color: colors.text }]}
            placeholder="Task title... (tap ⋯ for full details)"
            placeholderTextColor={colors.subtext}
            value={quickAddText}
            onChangeText={setQuickAddText}
            onSubmitEditing={quickAddTask}
            autoFocus
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.quickAddSend, quickAdding && { opacity: 0.5 }]}
            onPress={quickAddTask}
            disabled={quickAdding}
          >
            <Text style={styles.quickAddSendText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAddFull}
            onPress={() => {
              setQuickAddVisible(false);
              router.push("/create-task");
            }}
          >
            <Text style={styles.quickAddFullText}>⋯</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.fabRow}>
        <TouchableOpacity
          style={[styles.fab, quickAddVisible && styles.fabActive]}
          onPress={() => {
            setQuickAddVisible((v) => !v);
            if (quickAddVisible) setQuickAddText("");
          }}
        >
          <Text style={styles.fabText}>{quickAddVisible ? "✕" : "+"}</Text>
        </TouchableOpacity>
      </View>
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
    color: "#e65100",
  },
  dueSoonChipDate: {
    fontSize: 10,
    color: "#e65100",
    marginTop: 2,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: "#6200ee",
  },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  selectCircleChecked: {
    backgroundColor: "#6200ee",
  },
  selectCheckmark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  selectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#6200ee",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  selectionCount: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectionActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 6,
  },
  selectionActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  historyRow: {
    marginBottom: 6,
    flexGrow: 0,
  },
  historyChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 5,
    marginRight: 8,
  },
  historyChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  historyChipClose: {
    paddingLeft: 6,
    paddingRight: 2,
  },
  historyChipCloseText: {
    fontSize: 11,
  },
  quickAddBar: {
    position: "absolute",
    bottom: 88,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  quickAddInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 6,
  },
  quickAddSend: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  quickAddSendText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  quickAddFull: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#6200ee",
    justifyContent: "center",
    marginLeft: 6,
  },
  quickAddFullText: {
    color: "#6200ee",
    fontSize: 16,
    fontWeight: "bold",
  },
  fabRow: {
    position: "absolute",
    bottom: 24,
    right: 24,
  },
  fabActive: {
    backgroundColor: "#444",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hamburger: {
    marginRight: 12,
    padding: 4,
    position: "relative",
  },
  hamburgerText: {
    fontSize: 22,
  },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    flexDirection: "row",
  },
  sidebar: {
    width: 280,
    height: "100%",
    paddingTop: 60,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  sidebarHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sidebarAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  sidebarAvatarText: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  sidebarName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  sidebarEmail: {
    fontSize: 13,
    marginBottom: 8,
  },
  sidebarAdminBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fff3e0",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sidebarAdminText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e65100",
  },
  sidebarDivider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 20,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sidebarItemIcon: {
    fontSize: 18,
    marginRight: 16,
    width: 24,
    textAlign: "center",
  },
  sidebarItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  reactionBadge: {
    fontSize: 18,
    marginLeft: 6,
  },
  hamburgerBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#c62828",
  },
  sidebarSectionLabel: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  siebarSectionLabelText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sidebarChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sidebarChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  siebarChipActive: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  sidebarChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sidebarChipTextActive: {
    color: "#000000",
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 6,
  },
  dateRangeLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginHorizontal: 4,
  },
  dateBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  dateClear: {
    paddinghorizontal: 8,
    paddingVertical: 6,
  },
  dateClearText: {
    color: "#c62828",
    fontSize: 14,
    fontWeight: "600",
  },
  userPickerBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  userPickerText: {
    fontSize: 13,
    fontWeight: "600",
  },
  userModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  userModalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "60%",
  },
  userModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  userModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  userModalClose: {
    fontSize: 15,
    color: "#6200ee",
    fontWeight: "600",
  },
  userModalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  userModalRowActive: {
    backgroundColor: "#f3e8ff",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  userModalRowText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
