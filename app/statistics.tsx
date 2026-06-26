import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { getCategoryColor, getUserDisplayName } from "../lib/userHelper";

type Task = {
  id: string;
  completed: boolean;
  category: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  user_id: string;
};

type UserStat = {
  userId: string;
  name: string;
  total: number;
  completed: number;
  overdue: number;
};

export default function StatisticsScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userStats, setUserStats] = useState<UserStat[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const admin = user.email === "admin@test.com";
      setIsAdmin(admin);

      const query = supabase
        .from("tasks")
        .select(
          "id, completed, category, due_date, completed_at, created_at, user_id",
        );

      const { data, error } = admin
        ? await query
        : await query.eq("user_id", user.id);

      if (!error && data) {
        setTasks(data as Task[]);

        if (admin) {
          // Build per-user stats
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email");

          const profileMap: { [key: string]: any } = {};
          if (profiles) {
            profiles.forEach((p: any) => {
              profileMap[p.id] = p;
            });
          }

          const now = new Date();
          const grouped: { [key: string]: Task[] } = {};
          (data as Task[]).forEach((t) => {
            if (!grouped[t.user_id]) grouped[t.user_id] = [];
            grouped[t.user_id].push(t);
          });

          const stats: UserStat[] = Object.entries(grouped).map(
            ([userId, userTasks]) => ({
              userId,
              name: getUserDisplayName(userId, profileMap[userId]),
              total: userTasks.length,
              completed: userTasks.filter((t) => t.completed).length,
              overdue: userTasks.filter(
                (t) => !t.completed && t.due_date && new Date(t.due_date) < now,
              ).length,
            }),
          );

          stats.sort((a, b) => b.total - a.total);
          setUserStats(stats);
        }
      }
    } catch (e) {
      console.log("Error fetching stats:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Derived stats ---
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const now = new Date();
  const totalOverdue = tasks.filter(
    (t) => !t.completed && t.due_date && new Date(t.due_date) < now,
  ).length;

  // Category stats
  const categoryMap: { [key: string]: { total: number; completed: number } } =
    {};
  tasks.forEach((t) => {
    const cat = t.category || "Uncategorized";
    if (!categoryMap[cat]) categoryMap[cat] = { total: 0, completed: 0 };
    categoryMap[cat].total++;
    if (t.completed) categoryMap[cat].completed++;
  });
  const categoryStats = Object.entries(categoryMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6);

  // Weekly data
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const weekData = weekDays.map((day) => {
    const dayStr = day.toDateString();
    const count = tasks.filter(
      (t) =>
        t.completed_at && new Date(t.completed_at).toDateString() === dayStr,
    ).length;
    return { label: day.toLocaleDateString([], { weekday: "short" }), count };
  });
  const maxWeekCount = Math.max(...weekData.map((d) => d.count), 1);

  // On-time score
  const tasksWithDue = tasks.filter(
    (t) => t.completed && t.due_date && t.completed_at,
  );
  const onTime = tasksWithDue.filter(
    (t) => new Date(t.completed_at!) <= new Date(t.due_date!),
  ).length;
  const productivityScore =
    tasksWithDue.length > 0
      ? Math.round((onTime / tasksWithDue.length) * 100)
      : null;

  // SVG Ring
  const ringSize = 160;
  const strokeWidth = 14;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (completionPct / 100) * circumference;

  // Admin highlights
  const mostActive =
    userStats.length > 0
      ? [...userStats].sort((a, b) => b.completed - a.completed)[0]
      : null;
  const mostOverdue =
    userStats.length > 0
      ? [...userStats].sort((a, b) => b.overdue - a.overdue)[0]
      : null;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.text }]}>
        {isAdmin ? "Team Dashboard" : "Statistics"}
      </Text>

      {/* ADMIN ONLY — team overview cards */}
      {isAdmin && (
        <>
          <View style={styles.adminOverviewRow}>
            <View
              style={[styles.overviewCard, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.overviewNumber, { color: colors.text }]}>
                {total}
              </Text>
              <Text style={[styles.overviewLabel, { color: colors.subtext }]}>
                Total Tasks
              </Text>
            </View>
            <View
              style={[styles.overviewCard, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.overviewNumber, { color: "#2e7d32" }]}>
                {completed}
              </Text>
              <Text style={[styles.overviewLabel, { color: colors.subtext }]}>
                Completed
              </Text>
            </View>
            <View
              style={[styles.overviewCard, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.overviewNumber, { color: "#c62828" }]}>
                {totalOverdue}
              </Text>
              <Text style={[styles.overviewLabel, { color: colors.subtext }]}>
                Overdue
              </Text>
            </View>
            <View
              style={[styles.overviewCard, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.overviewNumber, { color: "#6200ee" }]}>
                {completionPct}%
              </Text>
              <Text style={[styles.overviewLabel, { color: colors.subtext }]}>
                Rate
              </Text>
            </View>
          </View>

          {/* Highlights */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Highlights
            </Text>
            {mostActive && mostActive.completed > 0 && (
              <View style={styles.highlightRow}>
                <Text style={styles.highlightIcon}>🏆</Text>
                <View>
                  <Text
                    style={[styles.highlightLabel, { color: colors.subtext }]}
                  >
                    Most Active
                  </Text>
                  <Text style={[styles.highlightValue, { color: colors.text }]}>
                    {mostActive.name} — {mostActive.completed} completed
                  </Text>
                </View>
              </View>
            )}
            {mostOverdue && mostOverdue.overdue > 0 && (
              <View style={styles.highlightRow}>
                <Text style={styles.highlightIcon}>⚠️</Text>
                <View>
                  <Text
                    style={[styles.highlightLabel, { color: colors.subtext }]}
                  >
                    Needs Attention
                  </Text>
                  <Text style={[styles.highlightValue, { color: colors.text }]}>
                    {mostOverdue.name} — {mostOverdue.overdue} overdue
                  </Text>
                </View>
              </View>
            )}
            {(!mostActive || mostActive.completed === 0) &&
              (!mostOverdue || mostOverdue.overdue === 0) && (
                <Text
                  style={[styles.highlightEmpty, { color: colors.subtext }]}
                >
                  No highlights yet. Tasks need to be completed or overdue.
                </Text>
              )}
          </View>

          {/* Per-user breakdown table */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Per-User Breakdown
            </Text>
            <View style={styles.tableHeader}>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { color: colors.subtext, flex: 2 },
                ]}
              >
                User
              </Text>
              <Text style={[styles.tableHeaderCell, { color: colors.subtext }]}>
                Total
              </Text>
              <Text style={[styles.tableHeaderCell, { color: colors.subtext }]}>
                Done
              </Text>
              <Text style={[styles.tableHeaderCell, { color: colors.subtext }]}>
                Overdue
              </Text>
            </View>
            {userStats.map((u) => (
              <View
                key={u.userId}
                style={[styles.tableRow, { borderBottomColor: colors.border }]}
              >
                <View
                  style={{
                    flex: 2,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View style={styles.tableAvatar}>
                    <Text style={styles.tableAvatarText}>
                      {u.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[styles.tableCell, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {u.name}
                  </Text>
                </View>
                <Text style={[styles.tableCell, { color: colors.text }]}>
                  {u.total}
                </Text>
                <Text style={[styles.tableCell, { color: "#2e7d32" }]}>
                  {u.completed}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { color: u.overdue > 0 ? "#c62828" : colors.subtext },
                  ]}
                >
                  {u.overdue}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Overall completion ring — shown for both */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Overall Completion
        </Text>
        <View style={styles.ringContainer}>
          <Svg width={ringSize} height={ringSize}>
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={colors.border}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="#6200ee"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${ringSize / 2}, ${ringSize / 2}`}
            />
            <SvgText
              x={ringSize / 2}
              y={ringSize / 2 - 8}
              textAnchor="middle"
              fontSize="28"
              fontWeight="bold"
              fill={colors.text}
            >
              {completionPct}%
            </SvgText>
            <SvgText
              x={ringSize / 2}
              y={ringSize / 2 + 14}
              textAnchor="middle"
              fontSize="12"
              fill={colors.subtext}
            >
              complete
            </SvgText>
          </Svg>
          <View style={styles.ringStats}>
            <View style={styles.ringStat}>
              <Text style={[styles.ringStatNumber, { color: colors.text }]}>
                {total}
              </Text>
              <Text style={[styles.ringStatLabel, { color: colors.subtext }]}>
                Total
              </Text>
            </View>
            <View style={styles.ringStat}>
              <Text style={[styles.ringStatNumber, { color: "#2e7d32" }]}>
                {completed}
              </Text>
              <Text style={[styles.ringStatLabel, { color: colors.subtext }]}>
                Done
              </Text>
            </View>
            <View style={styles.ringStat}>
              <Text style={[styles.ringStatNumber, { color: "#f9a825" }]}>
                {pending}
              </Text>
              <Text style={[styles.ringStatLabel, { color: colors.subtext }]}>
                Pending
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Weekly bar chart */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Completed This Week
        </Text>
        <View style={styles.barChart}>
          {weekData.map((day, i) => {
            const barHeight =
              maxWeekCount > 0
                ? Math.max(
                    (day.count / maxWeekCount) * 100,
                    day.count > 0 ? 8 : 0,
                  )
                : 0;
            return (
              <View key={i} style={styles.barColumn}>
                <Text style={[styles.barValue, { color: colors.text }]}>
                  {day.count > 0 ? day.count : ""}
                </Text>
                <View
                  style={[styles.barTrack, { backgroundColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.barFill,
                      { height: barHeight, backgroundColor: "#6200ee" },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: colors.subtext }]}>
                  {day.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Category breakdown */}
      {categoryStats.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Tasks by Category
          </Text>
          {categoryStats.map(([cat, data]) => {
            const pct = Math.round((data.completed / data.total) * 100);
            const color = getCategoryColor(
              cat === "Uncategorized" ? null : cat,
            );
            return (
              <View key={cat} style={styles.categoryRow}>
                <View style={styles.categoryLabelRow}>
                  <View
                    style={[styles.categoryDot, { backgroundColor: color }]}
                  />
                  <Text
                    style={[styles.categoryName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {cat}
                  </Text>
                  <Text
                    style={[styles.categoryCount, { color: colors.subtext }]}
                  >
                    {data.completed}/{data.total}
                  </Text>
                </View>
                <View
                  style={[
                    styles.categoryBarTrack,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.categoryBarFill,
                      { width: `${pct}%`, backgroundColor: color },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* On-time score */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          On-Time Completion
        </Text>
        {productivityScore !== null ? (
          <>
            <Text style={[styles.productivityScore, { color: "#6200ee" }]}>
              {productivityScore}%
            </Text>
            <Text style={[styles.productivityLabel, { color: colors.subtext }]}>
              of completed tasks were finished on or before their due date
            </Text>
            <Text
              style={[styles.productivitySample, { color: colors.subtext }]}
            >
              Based on {tasksWithDue.length} task
              {tasksWithDue.length !== 1 ? "s" : ""} with due dates
            </Text>
          </>
        ) : (
          <Text style={[styles.productivityLabel, { color: colors.subtext }]}>
            Complete some tasks with due dates to see your on-time rate.
          </Text>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 16, color: "#6200ee", fontWeight: "bold" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 16 },
  card: { borderRadius: 16, padding: 20, marginBottom: 16, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  adminOverviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  overviewCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    elevation: 1,
  },
  overviewNumber: { fontSize: 22, fontWeight: "bold" },
  overviewLabel: { fontSize: 10, marginTop: 4, textAlign: "center" },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  highlightIcon: { fontSize: 22, marginRight: 12 },
  highlightLabel: { fontSize: 11, fontWeight: "600" },
  highlightValue: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  highlightEmpty: { fontSize: 13, textAlign: "center", paddingVertical: 8 },
  tableHeader: { flexDirection: "row", marginBottom: 8 },
  tableHeaderCell: { flex: 1, fontSize: 11, fontWeight: "700" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  tableAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  tableAvatarText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  tableCell: { flex: 1, fontSize: 13 },
  ringContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ringStats: { flex: 1, paddingLeft: 24, gap: 16 },
  ringStat: { alignItems: "flex-start" },
  ringStatNumber: { fontSize: 24, fontWeight: "bold" },
  ringStatLabel: { fontSize: 12, marginTop: 2 },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 120,
  },
  barColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barValue: { fontSize: 11, fontWeight: "600", marginBottom: 4, height: 16 },
  barTrack: {
    width: 28,
    height: 100,
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: 6 },
  barLabel: { fontSize: 11, marginTop: 6 },
  categoryRow: { marginBottom: 14 },
  categoryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  categoryName: { flex: 1, fontSize: 14, fontWeight: "500" },
  categoryCount: { fontSize: 12 },
  categoryBarTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  categoryBarFill: { height: 8, borderRadius: 4 },
  productivityScore: { fontSize: 48, fontWeight: "bold", marginBottom: 8 },
  productivityLabel: { fontSize: 14, lineHeight: 20 },
  productivitySample: { fontSize: 12, marginTop: 8 },
});
