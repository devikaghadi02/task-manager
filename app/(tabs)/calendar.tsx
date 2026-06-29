import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

type Profile = {
  id: string;
  email: string;
  full_name: string;
};

type GridCell = { day: number; key: string } | null;

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Local (not UTC) day key so "due today" lines up with what the user sees
// on their device, regardless of how due_date's time-of-day is stored.
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function parseDueDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

export default function CalendarScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileMap, setProfileMap] = useState<{ [key: string]: Profile }>({});

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedKey, setSelectedKey] = useState(dateKey(today));

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
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

      if (admin) {
        const { data: tasksData, error } = await supabase
          .from("tasks")
          .select("*");
        if (error) throw error;

        const { data: profilesData } = await supabase
          .from("profiles")
          .select("*");
        const map: { [key: string]: Profile } = {};
        (profilesData as Profile[] | null)?.forEach((p) => {
          map[p.id] = p;
        });
        setProfileMap(map);
        setTasks((tasksData as Task[]) || []);
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id);
        if (error) throw error;
        setTasks((data as Task[]) || []);
      }
    } catch (e) {
      console.log("Error fetching tasks for calendar:", e);
    }
    setLoading(false);
  };

  // Group tasks (that have a due date) by local day key.
  const tasksByDate = useMemo(() => {
    const map: { [key: string]: Task[] } = {};
    tasks.forEach((t) => {
      const d = parseDueDate(t.due_date);
      if (!d) return;
      const key = dateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  // Build the flat list of grid cells (nulls = leading/trailing blanks)
  // for the currently displayed month, then chunk into rows of 7.
  const gridRows = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((daysInMonth + firstDayOfWeek) / 7) * 7;

    const cells: GridCell[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDayOfWeek + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells.push(null);
      } else {
        const d = new Date(year, month, dayNum);
        cells.push({ day: dayNum, key: dateKey(d) });
      }
    }

    const rows: GridCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [currentMonth]);

  const goPrevMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNextMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday = () => {
    const t = new Date();
    setCurrentMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    setSelectedKey(dateKey(t));
  };

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const [selYear, selMonth, selDay] = selectedKey.split("-").map(Number);
  const selectedDateObj = new Date(selYear, selMonth, selDay);
  const selectedDateLabel = selectedDateObj.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const selectedDayTasks = tasksByDate[selectedKey] ?? [];
  const todayKey = dateKey(today);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          Calendar
        </Text>
        <TouchableOpacity onPress={goToday}>
          <Text style={styles.todayLink}>Today</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.calendarCard, { backgroundColor: colors.card }]}>
        <View style={styles.monthNavRow}>
          <TouchableOpacity style={styles.monthNavButton} onPress={goPrevMonth}>
            <Text style={styles.monthNavArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: colors.text }]}>
            {monthLabel}
          </Text>
          <TouchableOpacity style={styles.monthNavButton} onPress={goNextMonth}>
            <Text style={styles.monthNavArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, i) => (
            <View key={i} style={styles.weekdayCell}>
              <Text style={[styles.weekdayText, { color: colors.subtext }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        {gridRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((cell, cellIndex) => {
              if (!cell) {
                return <View key={cellIndex} style={styles.dayCell} />;
              }

              const dayTasks = tasksByDate[cell.key];
              const hasTasks = !!dayTasks && dayTasks.length > 0;
              const allCompleted =
                hasTasks && dayTasks!.every((t) => t.completed);
              const isSelected = cell.key === selectedKey;
              const isToday = cell.key === todayKey;

              return (
                <TouchableOpacity
                  key={cellIndex}
                  style={styles.dayCell}
                  onPress={() => setSelectedKey(cell.key)}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isSelected && styles.dayCircleSelected,
                      !isSelected && isToday && { borderColor: "#6200ee" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        { color: colors.text },
                        isSelected && styles.dayNumberSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.dot,
                      { opacity: hasTasks ? 1 : 0 },
                      allCompleted ? styles.dotCompleted : styles.dotPending,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.selectedSection}>
        <Text style={[styles.selectedDateLabel, { color: colors.text }]}>
          {selectedDateLabel}
        </Text>

        {selectedDayTasks.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            No tasks due this day.
          </Text>
        ) : (
          selectedDayTasks.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.dayTaskCard, { backgroundColor: colors.card }]}
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
              <View
                style={[
                  styles.statusDot,
                  item.completed
                    ? styles.dotCompletedSmall
                    : styles.dotPendingSmall,
                ]}
              />
              <View style={styles.dayTaskTextWrap}>
                <Text
                  style={[
                    styles.dayTaskTitle,
                    { color: colors.text },
                    item.completed && styles.dayTaskTitleCompleted,
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <View style={styles.dayTaskMetaRow}>
                  {isAdmin && (
                    <Text
                      style={[styles.dayTaskMeta, { color: colors.subtext }]}
                    >
                      {getUserDisplayName(
                        item.user_id,
                        profileMap[item.user_id] ?? null,
                      )}
                    </Text>
                  )}
                  {item.category && (
                    <View
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor:
                            getCategoryColor(item.category) + "22",
                        },
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
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "bold",
  },
  todayLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  calendarCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    elevation: 1,
  },
  monthNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  monthNavArrow: {
    fontSize: 22,
    color: "#6200ee",
    fontWeight: "bold",
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: "bold",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: "600",
  },
  gridRow: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  dayCircleSelected: {
    backgroundColor: "#6200ee",
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: "500",
  },
  dayNumberSelected: {
    color: "#fff",
    fontWeight: "bold",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  dotPending: {
    backgroundColor: "#6200ee",
  },
  dotCompleted: {
    backgroundColor: "#2e7d32",
  },
  selectedSection: {
    marginTop: 4,
  },
  selectedDateLabel: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
  },
  dayTaskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    elevation: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  dotPendingSmall: {
    backgroundColor: "#f9a825",
  },
  dotCompletedSmall: {
    backgroundColor: "#2e7d32",
  },
  dayTaskTextWrap: {
    flex: 1,
  },
  dayTaskTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  dayTaskTitleCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  dayTaskMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
  },
  dayTaskMeta: {
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
});
