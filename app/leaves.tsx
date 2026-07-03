import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
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

type LeaveRequest = {
  id: string;
  employee_id: string;
  type: string;
  from_date: string;
  to_date: string;
  reason: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  employee_name?: string;
};

const LEAVE_TYPES = ["Sick", "Casual", "Earned", "Emergency", "Unpaid"];

export default function LeavesScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [adminNoteModalVisible, setAdminNoteModalVisible] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "approved" | "rejected" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

  // Apply form state
  const [leaveType, setLeaveType] = useState("Sick");
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [reason, setReason] = useState("");
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const admin = user.email === "admin@test.com";
      setIsAdmin(admin);
      setCurrentUserId(user.id);

      // Fetch leave requests
      const query = supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });

      const { data, error } = admin
        ? await query
        : await query.eq("employee_id", user.id);

      if (!error && data) {
        if (admin) {
          // Fetch employee names
          const { data: emps } = await supabase
            .from("employees")
            .select("id, full_name, email");

          const empMap: { [key: string]: string } = {};
          if (emps) {
            emps.forEach((e: any) => {
              empMap[e.id] = e.full_name || e.email?.split("@")[0] || "Unknown";
            });
          }

          setLeaves(
            data.map((l: any) => ({
              ...l,
              employee_name: empMap[l.employee_id] || "Unknown",
            })),
          );
        } else {
          setLeaves(data as LeaveRequest[]);
        }
      }
    } catch (e) {
      console.log("Error fetching leaves:", e);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const applyLeave = async () => {
    if (fromDate > toDate) {
      alert("From date cannot be after To date.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .insert({
          employee_id: currentUserId,
          type: leaveType,
          from_date: fromDate.toISOString().split("T")[0],
          to_date: toDate.toISOString().split("T")[0],
          reason: reason.trim() || null,
          status: "pending",
        })
        .select()
        .single();

      if (!error && data) {
        setLeaves([data as LeaveRequest, ...leaves]);
        setApplyModalVisible(false);
        setReason("");
        setLeaveType("Sick");
        setFromDate(new Date());
        setToDate(new Date());
      }
    } catch (e) {
      console.log("Error applying leave:", e);
    }
    setSaving(false);
  };

  const openAdminAction = (
    leave: LeaveRequest,
    action: "approved" | "rejected",
  ) => {
    setSelectedLeave(leave);
    setPendingAction(action);
    setAdminNote("");
    setAdminNoteModalVisible(true);
  };

  const confirmAdminAction = async () => {
    if (!selectedLeave || !pendingAction) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: pendingAction,
          admin_note: adminNote.trim() || null,
        })
        .eq("id", selectedLeave.id);

      if (!error) {
        setLeaves(
          leaves.map((l) =>
            l.id === selectedLeave.id
              ? {
                  ...l,
                  status: pendingAction,
                  admin_note: adminNote.trim() || null,
                }
              : l,
          ),
        );
        setAdminNoteModalVisible(false);
        setDetailModalVisible(false);
      }
    } catch (e) {
      console.log("Error updating leave:", e);
    }
    setSaving(false);
  };

  const getDays = (from: string, to: string) => {
    const diff = new Date(to).getTime() - new Date(from).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const getStatusColor = (status: string) => {
    if (status === "approved") return "#2e7d32";
    if (status === "rejected") return "#c62828";
    return "#f9a825";
  };

  const filteredLeaves =
    activeTab === "pending"
      ? leaves.filter((l) => l.status === "pending")
      : leaves;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Apply Leave Modal */}
      <Modal
        visible={applyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setApplyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Apply for Leave
              </Text>
              <TouchableOpacity onPress={() => setApplyModalVisible(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Leave Type
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {LEAVE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      leaveType === type && styles.chipActive,
                    ]}
                    onPress={() => setLeaveType(type)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.subtext },
                        leaveType === type && styles.chipTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                From Date
              </Text>
              <TouchableOpacity
                style={[
                  styles.dateBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => setShowFromPicker(true)}
              >
                <Text style={[styles.dateBtnText, { color: colors.text }]}>
                  {fromDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              {showFromPicker && (
                <DateTimePicker
                  value={fromDate}
                  mode="date"
                  display="default"
                  onChange={(_, date) => {
                    setShowFromPicker(false);
                    if (date) setFromDate(date);
                  }}
                />
              )}

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                To Date
              </Text>
              <TouchableOpacity
                style={[
                  styles.dateBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => setShowToPicker(true)}
              >
                <Text style={[styles.dateBtnText, { color: colors.text }]}>
                  {toDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              {showToPicker && (
                <DateTimePicker
                  value={toDate}
                  mode="date"
                  display="default"
                  onChange={(_, date) => {
                    setShowToPicker(false);
                    if (date) setToDate(date);
                  }}
                />
              )}

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Reason (Optional)
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
                placeholder="Reason for leave..."
                placeholderTextColor={colors.subtext}
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                onPress={applyLeave}
                disabled={saving}
              >
                <Text style={styles.submitBtnText}>
                  {saving ? "Submitting..." : "Submit Leave Request"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Leave Details
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {selectedLeave && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {isAdmin && (
                  <Text style={[styles.employeeName, { color: colors.text }]}>
                    {selectedLeave.employee_name}
                  </Text>
                )}

                <View
                  style={[styles.detailCard, { backgroundColor: colors.card }]}
                >
                  {[
                    { label: "Type", value: selectedLeave.type },
                    {
                      label: "From",
                      value: new Date(
                        selectedLeave.from_date,
                      ).toLocaleDateString(),
                    },
                    {
                      label: "To",
                      value: new Date(
                        selectedLeave.to_date,
                      ).toLocaleDateString(),
                    },
                    {
                      label: "Days",
                      value: `${getDays(selectedLeave.from_date, selectedLeave.to_date)} day(s)`,
                    },
                    { label: "Reason", value: selectedLeave.reason || "—" },
                    {
                      label: "Applied on",
                      value: new Date(
                        selectedLeave.created_at,
                      ).toLocaleDateString(),
                    },
                  ].map(({ label, value }) => (
                    <View
                      key={label}
                      style={[
                        styles.detailRow,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[styles.detailLabel, { color: colors.subtext }]}
                      >
                        {label}
                      </Text>
                      <Text
                        style={[styles.detailValue, { color: colors.text }]}
                      >
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        getStatusColor(selectedLeave.status) + "22",
                      alignSelf: "flex-start",
                      marginBottom: 12,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(selectedLeave.status) },
                    ]}
                  >
                    {selectedLeave.status.charAt(0).toUpperCase() +
                      selectedLeave.status.slice(1)}
                  </Text>
                </View>

                {selectedLeave.admin_note && (
                  <View
                    style={[
                      styles.noteCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.noteLabel, { color: colors.subtext }]}>
                      Admin Note
                    </Text>
                    <Text style={[styles.noteText, { color: colors.text }]}>
                      {selectedLeave.admin_note}
                    </Text>
                  </View>
                )}

                {isAdmin && selectedLeave.status === "pending" && (
                  <View style={styles.adminActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#2e7d32" }]}
                      onPress={() => openAdminAction(selectedLeave, "approved")}
                    >
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#c62828" }]}
                      onPress={() => openAdminAction(selectedLeave, "rejected")}
                    >
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Admin Note Modal */}
      <Modal
        visible={adminNoteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAdminNoteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {pendingAction === "approved"
                  ? "Approve Leave"
                  : "Reject Leave"}
              </Text>
              <TouchableOpacity onPress={() => setAdminNoteModalVisible(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
              Add a note (optional)
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
              placeholder={
                pendingAction === "approved"
                  ? "e.g. Enjoy your leave!"
                  : "e.g. We need you on that date"
              }
              placeholderTextColor={colors.subtext}
              value={adminNote}
              onChangeText={setAdminNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor:
                    pendingAction === "approved" ? "#2e7d32" : "#c62828",
                },
                saving && { opacity: 0.6 },
              ]}
              onPress={confirmAdminAction}
              disabled={saving}
            >
              <Text style={styles.submitBtnText}>
                {saving
                  ? "Saving..."
                  : pendingAction === "approved"
                    ? "Confirm Approve"
                    : "Confirm Reject"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {isAdmin ? "Leave Requests" : "My Leaves"}
        </Text>
        {!isAdmin && (
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => setApplyModalVisible(true)}
          >
            <Text style={styles.applyBtnText}>+ Apply</Text>
          </TouchableOpacity>
        )}
        {isAdmin && <View style={{ width: 60 }} />}
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.card }]}>
        {(["pending", "all"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? "#fff" : colors.subtext },
              ]}
            >
              {tab === "pending" ? "Pending" : "All"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredLeaves}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => {
              setSelectedLeave(item);
              setDetailModalVisible(true);
            }}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardLeft}>
                <Text style={[styles.leaveType, { color: colors.text }]}>
                  {item.type} Leave
                </Text>
                {isAdmin && (
                  <Text style={[styles.employeeTag, { color: colors.subtext }]}>
                    {item.employee_name}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(item.status) + "22" },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(item.status) },
                  ]}
                >
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <Text style={[styles.dateRange, { color: colors.subtext }]}>
                {new Date(item.from_date).toLocaleDateString()} —{" "}
                {new Date(item.to_date).toLocaleDateString()}
              </Text>
              <Text style={[styles.daysCount, { color: "#6200ee" }]}>
                {getDays(item.from_date, item.to_date)} day(s)
              </Text>
            </View>
            {item.admin_note && (
              <Text
                style={[styles.adminNotePreview, { color: colors.subtext }]}
                numberOfLines={1}
              >
                Note: {item.admin_note}
              </Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            {activeTab === "pending"
              ? "No pending leave requests"
              : "No leave requests yet"}
          </Text>
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
    marginBottom: 16,
  },
  backText: { fontSize: 16, color: "#6200ee", fontWeight: "bold" },
  title: { fontSize: 22, fontWeight: "bold" },
  applyBtn: {
    backgroundColor: "#6200ee",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  tabRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: "#6200ee" },
  tabText: { fontSize: 13, fontWeight: "600" },
  card: { borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardLeft: { flex: 1 },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leaveType: { fontSize: 15, fontWeight: "600" },
  employeeTag: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "600" },
  dateRange: { fontSize: 12 },
  daysCount: { fontSize: 12, fontWeight: "700" },
  adminNotePreview: { fontSize: 11, marginTop: 6, fontStyle: "italic" },
  emptyText: { textAlign: "center", marginTop: 40, fontSize: 15 },
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
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  modalClose: { fontSize: 15, color: "#6200ee", fontWeight: "600" },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#6200ee", borderColor: "#6200ee" },
  chipText: { fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  dateBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  dateBtnText: { fontSize: 15 },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: "#6200ee",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  employeeName: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  detailCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  detailLabel: { fontSize: 13, fontWeight: "500" },
  detailValue: { fontSize: 14, fontWeight: "600" },
  noteCard: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  noteLabel: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  noteText: { fontSize: 14 },
  adminActions: { flexDirection: "row", gap: 12, marginBottom: 16 },
  actionBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
});
