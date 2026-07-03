import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_by: string | null;
  cretaed_at: string;
  creator_name?: string;
};

export default function AnnouncementsScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const admin = user.email === "admin@test.com";
      setIsAdmin(admin);

      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("cretaed_at", { ascending: false });

      if (!error && data) {
        // Fetch creator names
        const { data: emps } = await supabase
          .from("profiles")
          .select("id, full_name, email");

        const empMap: { [key: string]: string } = {};
        if (emps) {
          emps.forEach((e: any) => {
            empMap[e.id] = e.full_name || e.email?.split("@")[0] || "Unknown";
          });
        }

        setAnnouncements(
          data.map((a: any) => ({
            ...a,
            creator_name: a.created_by
              ? empMap[a.created_by] || "Admin"
              : "Admin",
          })),
        );
      }
    } catch (e) {
      console.log("Error fetching announcements:", e);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const createAnnouncement = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Title is required.");
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("announcements")
        .insert({
          title: title.trim(),
          body: body.trim(),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.log("Announcements fetch error:", error);
        Alert.alert("Fetch Error", error.message);
      } else if (data) {
        setAnnouncements([
          { ...data, creator_name: "Admin" },
          ...announcements,
        ]);
        setCreateModalVisible(false);
        setTitle("");
        setBody("");
      }
    } catch (e) {
      console.log("Error creating announcement:", e);
    }
    setSaving(false);
  };

  const deleteAnnouncement = async (id: string) => {
    Alert.alert(
      "Delete Announcement",
      "Are you sure you want to delete this announcement?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.from("announcements").delete().eq("id", id);
              setAnnouncements(announcements.filter((a) => a.id !== id));
              setDetailModalVisible(false);
            } catch (e) {
              console.log("Error deleting announcement:", e);
            }
          },
        },
      ],
    );
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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
      {/* Create Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                New Announcement
              </Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
              Title
            </Text>
            <TextInput
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Announcement title..."
              placeholderTextColor={colors.subtext}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
              Body
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Write your announcement here..."
              placeholderTextColor={colors.subtext}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={[styles.submitBtn, saving && { opacity: 0.6 }]}
              onPress={createAnnouncement}
              disabled={saving}
            >
              <Text style={styles.submitBtnText}>
                {saving ? "Posting..." : "Post Announcement"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {selectedAnnouncement?.title}
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {selectedAnnouncement && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailMeta}>
                  <Text
                    style={[styles.detailMetaText, { color: colors.subtext }]}
                  >
                    Posted by {selectedAnnouncement.creator_name}
                  </Text>
                  <Text
                    style={[styles.detailMetaText, { color: colors.subtext }]}
                  >
                    {new Date(
                      selectedAnnouncement.cretaed_at,
                    ).toLocaleDateString([], {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>

                <Text style={[styles.detailBody, { color: colors.text }]}>
                  {selectedAnnouncement.body || "No details provided."}
                </Text>

                {isAdmin && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deleteAnnouncement(selectedAnnouncement.id)}
                  >
                    <Text style={styles.deleteBtnText}>
                      Delete Announcement
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          Announcements
        </Text>
        {isAdmin ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setCreateModalVisible(true)}
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => {
              setSelectedAnnouncement(item);
              setDetailModalVisible(true);
            }}
          >
            <View style={styles.cardHeader}>
              <Text
                style={[styles.cardTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={[styles.cardTime, { color: colors.subtext }]}>
                {timeAgo(item.cretaed_at)}
              </Text>
            </View>
            <Text
              style={[styles.cardBody, { color: colors.subtext }]}
              numberOfLines={2}
            >
              {item.body || "No details"}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.subtext }]}>
              By {item.creator_name}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              No announcements yet.
            </Text>
            {isAdmin && (
              <Text style={[styles.emptyHint, { color: colors.subtext }]}>
                Tap &quot;+ New&quot; to post one.
              </Text>
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backText: { fontSize: 16, color: "#6200ee", fontWeight: "bold" },
  title: { fontSize: 22, fontWeight: "bold" },
  addBtn: {
    backgroundColor: "#6200ee",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  cardTime: { fontSize: 11 },
  cardBody: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  cardMeta: { fontSize: 11 },
  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, marginBottom: 8 },
  emptyHint: { fontSize: 13 },
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
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", flex: 1, marginRight: 8 },
  modalClose: { fontSize: 15, color: "#6200ee", fontWeight: "600" },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: "#6200ee",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  detailMeta: { marginBottom: 16, gap: 4 },
  detailMetaText: { fontSize: 12 },
  detailBody: { fontSize: 15, lineHeight: 24, marginBottom: 24 },
  deleteBtn: {
    backgroundColor: "#ffebee",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  deleteBtnText: { color: "#c62828", fontWeight: "700", fontSize: 15 },
});
