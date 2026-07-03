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

type Employee = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  joining_date: string | null;
  status: string | null;
};

const DEPARTMENTS = [
  "Engineering",
  "Design",
  "Marketing",
  "Sales",
  "HR",
  "Finance",
  "Operations",
];
const DESIGNATIONS = [
  "Intern",
  "Junior",
  "Mid-level",
  "Senior",
  "Lead",
  "Manager",
  "Director",
];

export default function EmployeeScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editPhone, setEditPhone] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editDesignation, setEditDesignation] = useState("");
  const [editJoiningDate, setEditJoiningDate] = useState("");
  const [editStatus, setEditStatus] = useState("active");

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const admin = user.email === "admin@test.com";
      setIsAdmin(admin);

      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("full_name", { ascending: true });

      if (!error && data) setEmployees(data as Employee[]);
    } catch (e) {
      console.log("Error fetching employees:", e);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const openDetail = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDetailModalVisible(true);
  };

  const openEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEditPhone(emp.phone || "");
    setEditDepartment(emp.department || "");
    setEditDesignation(emp.designation || "");
    setEditJoiningDate(emp.joining_date || "");
    setEditStatus(emp.status || "active");
    setDetailModalVisible(false);
    setEditModalVisible(true);
  };

  const saveEmployee = async () => {
    if (!selectedEmployee) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          phone: editPhone.trim() || null,
          department: editDepartment.trim() || null,
          designation: editDesignation.trim() || null,
          joining_date: editJoiningDate.trim() || null,
          status: editStatus,
        })
        .eq("id", selectedEmployee.id);

      if (error) throw error;

      setEmployees(
        employees.map((e) =>
          e.id === selectedEmployee.id
            ? {
                ...e,
                phone: editPhone,
                department: editDepartment,
                designation: editDesignation,
                joining_date: editJoiningDate,
                status: editStatus,
              }
            : e,
        ),
      );
      setEditModalVisible(false);
    } catch (e) {
      console.log("Error saving employee:", e);
    }
    setSaving(false);
  };

  const filteredEmployees = employees.filter((e) => {
    const name = e.full_name?.toLowerCase() || "";
    const dept = e.department?.toLowerCase() || "";
    const desig = e.designation?.toLowerCase() || "";
    const search = searchText.toLowerCase();
    return (
      name.includes(search) || dept.includes(search) || desig.includes(search)
    );
  });

  const getInitial = (name: string | null) =>
    name ? name.charAt(0).toUpperCase() : "?";

  const getStatusColor = (status: string | null) =>
    status === "active"
      ? "#2e7d32"
      : status === "inactive"
        ? "#c62828"
        : "#f9a825";

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                Employee Profile
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {selectedEmployee && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.profileAvatarWrap}>
                  <View
                    style={[
                      styles.profileAvatar,
                      { backgroundColor: "#6200ee" },
                    ]}
                  >
                    <Text style={styles.profileAvatarText}>
                      {getInitial(selectedEmployee.full_name)}
                    </Text>
                  </View>
                  <Text style={[styles.profileName, { color: colors.text }]}>
                    {selectedEmployee.full_name || "No name"}
                  </Text>
                  <Text
                    style={[styles.profileEmail, { color: colors.subtext }]}
                  >
                    {selectedEmployee.email}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          getStatusColor(selectedEmployee.status) + "22",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(selectedEmployee.status) },
                      ]}
                    >
                      {selectedEmployee.status || "active"}
                    </Text>
                  </View>
                </View>

                <View
                  style={[styles.detailCard, { backgroundColor: colors.card }]}
                >
                  {[
                    { label: "Department", value: selectedEmployee.department },
                    {
                      label: "Designation",
                      value: selectedEmployee.designation,
                    },
                    { label: "Phone", value: selectedEmployee.phone },
                    {
                      label: "Joining Date",
                      value: selectedEmployee.joining_date,
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
                        {value || "—"}
                      </Text>
                    </View>
                  ))}
                </View>

                {isAdmin && (
                  <TouchableOpacity
                    style={[styles.editBtn, { backgroundColor: "#6200ee" }]}
                    onPress={() => openEdit(selectedEmployee)}
                  >
                    <Text style={styles.editBtnText}>Edit Details</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Edit Employee
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Phone
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
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Phone number"
                placeholderTextColor={colors.subtext}
                keyboardType="phone-pad"
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Department
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
              >
                {DEPARTMENTS.map((dept) => (
                  <TouchableOpacity
                    key={dept}
                    style={[
                      styles.chipOption,
                      { borderColor: colors.border },
                      editDepartment === dept && styles.chipOptionActive,
                    ]}
                    onPress={() => setEditDepartment(dept)}
                  >
                    <Text
                      style={[
                        styles.chipOptionText,
                        { color: colors.subtext },
                        editDepartment === dept && styles.chipOptionTextActive,
                      ]}
                    >
                      {dept}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Designation
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
              >
                {DESIGNATIONS.map((desig) => (
                  <TouchableOpacity
                    key={desig}
                    style={[
                      styles.chipOption,
                      { borderColor: colors.border },
                      editDesignation === desig && styles.chipOptionActive,
                    ]}
                    onPress={() => setEditDesignation(desig)}
                  >
                    <Text
                      style={[
                        styles.chipOptionText,
                        { color: colors.subtext },
                        editDesignation === desig &&
                          styles.chipOptionTextActive,
                      ]}
                    >
                      {desig}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Joining Date
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
                value={editJoiningDate}
                onChangeText={setEditJoiningDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.subtext}
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Status
              </Text>
              <View style={styles.statusRow}>
                {["active", "inactive", "on_leave"].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.chipOption,
                      { borderColor: colors.border },
                      editStatus === s && {
                        backgroundColor: getStatusColor(s),
                        borderColor: getStatusColor(s),
                      },
                    ]}
                    onPress={() => setEditStatus(s)}
                  >
                    <Text
                      style={[
                        styles.chipOptionText,
                        { color: editStatus === s ? "#fff" : colors.subtext },
                      ]}
                    >
                      {s.replace("_", " ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.editBtn,
                  { backgroundColor: "#6200ee", marginTop: 20 },
                ]}
                onPress={saveEmployee}
                disabled={saving}
              >
                <Text style={styles.editBtnText}>
                  {saving ? "Saving..." : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Main Screen */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Employees</Text>
        <Text style={[styles.countText, { color: colors.subtext }]}>
          {filteredEmployees.length} total
        </Text>
      </View>

      <TextInput
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        placeholder="Search by name, department, designation..."
        placeholderTextColor={colors.subtext}
        value={searchText}
        onChangeText={setSearchText}
      />

      <FlatList
        data={filteredEmployees}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => openDetail(item)}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.avatar, { backgroundColor: "#6200ee" }]}>
                <Text style={styles.avatarText}>
                  {getInitial(item.full_name)}
                </Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.text }]}>
                  {item.full_name || "Unknown"}
                </Text>
                <Text style={[styles.cardSub, { color: colors.subtext }]}>
                  {item.designation || "No designation"}{" "}
                  {item.department ? `· ${item.department}` : ""}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(item.status) },
              ]}
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            No employees found
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
  title: { fontSize: 24, fontWeight: "bold" },
  countText: { fontSize: 13 },
  searchBar: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 12, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
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
  profileAvatarWrap: { alignItems: "center", marginBottom: 20 },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  profileAvatarText: { color: "#fff", fontSize: 30, fontWeight: "bold" },
  profileName: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  profileEmail: { fontSize: 13, marginBottom: 10 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "600" },
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
  editBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  editBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  chipOption: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipOptionActive: { backgroundColor: "#6200ee", borderColor: "#6200ee" },
  chipOptionText: { fontSize: 13, fontWeight: "500" },
  chipOptionTextActive: { color: "#fff", fontWeight: "700" },
  statusRow: { flexDirection: "row", marginBottom: 8 },
});
