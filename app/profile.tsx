import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { getUserDisplayName } from "../lib/userHelper";

export default function ProfileScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [fullName, setFullName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email || "");
      setUserId(user.id);
      const admin = user.email === "admin@test.com";
      setIsAdmin(admin);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setFullName(getUserDisplayName(user.id, profile));

      // Load task stats for this specific user
      const { data: userTasks } = await supabase
        .from("tasks")
        .select("completed")
        .eq("user_id", user.id);

      if (userTasks) {
        const completed = userTasks.filter((t) => t.completed).length;
        setStats({
          total: userTasks.length,
          completed,
          pending: userTasks.length - completed,
        });
      }
    } catch (e) {
      console.log("Error loading profile:", e);
    }
    setLoading(false);
  };

  const saveName = async () => {
    if (!fullName.trim()) return;
    setSavingName(true);
    try {
      await supabase
        .from("profiles")
        .upsert({ id: userId, email, full_name: fullName.trim() });
      setEditingName(false);
    } catch (e) {
      console.log("Error saving name:", e);
    }
    setSavingName(false);
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

      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {fullName.charAt(0).toUpperCase()}
          </Text>
        </View>

        {editingName ? (
          <View style={styles.editNameRow}>
            <TextInput
              style={[
                styles.nameInput,
                { color: colors.text, borderColor: colors.border },
              ]}
              value={fullName}
              onChangeText={setFullName}
              autoFocus
            />
            <TouchableOpacity onPress={saveName} disabled={savingName}>
              <Text style={styles.saveLink}>{savingName ? "..." : "Save"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingName(true)}>
            <Text style={[styles.name, { color: colors.text }]}>
              {fullName} <Text style={styles.editHint}>(edit)</Text>
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.email, { color: colors.subtext }]}>{email}</Text>

        <View style={isAdmin ? styles.adminBadge : styles.userBadge}>
          <Text style={isAdmin ? styles.adminBadgeText : styles.userBadgeText}>
            {isAdmin ? "Admin" : "User"}
          </Text>
        </View>
      </View>

      <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
        <Text style={[styles.statsTitle, { color: colors.text }]}>
          Your Stats
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>
              Total
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: "#2e7d32" }]}>
              {stats.completed}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>
              Completed
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: "#f9a825" }]}>
              {stats.pending}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>
              Pending
            </Text>
          </View>
        </View>

        {stats.total > 0 && (
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${(stats.completed / stats.total) * 100}%` },
              ]}
            />
          </View>
        )}
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
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: "#6200ee",
    fontWeight: "bold",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "bold",
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  editHint: {
    fontSize: 13,
    color: "#6200ee",
    fontWeight: "normal",
  },
  editNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 18,
    borderBottomWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 8,
    minWidth: 150,
    textAlign: "center",
  },
  saveLink: {
    color: "#6200ee",
    fontWeight: "bold",
    fontSize: 14,
  },
  email: {
    fontSize: 14,
    marginBottom: 12,
  },
  adminBadge: {
    backgroundColor: "#fff3e0",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  adminBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e65100",
  },
  userBadge: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  userBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2e7d32",
  },
  statsContainer: {
    padding: 20,
    borderRadius: 16,
    elevation: 1,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statBox: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    backgroundColor: "#2e7d32",
  },
});
