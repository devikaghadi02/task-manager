import { useFocusEffect } from "@react-navigation/native";
import { decode } from "base64-arraybuffer";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";

import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
  dob: string | null;
  role: string | null;
  aadhar_url: string | null;
  marksheet_urls: string[] | null;
  deactivated_at: string | null;
};

type LeaveBalance = {
  annual: number;
  sick: number;
  casual: number;
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

const ROLES = ["Employee", "Senior", "Management"];

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
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  //Add employee form state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addDob, setAddDob] = useState("");
  const [addRole, setAddRole] = useState("Employee");
  const [addDepartment, setAddDepartment] = useState("");
  const [addDesignation, setAddDesignation] = useState("");
  const [addJoiningDate, setAddJoiningDate] = useState("");
  const [addAadharUrl, setAddAadharUrl] = useState<string | null>(null);
  const [addAadharName, setAddAadharName] = useState("");
  const [addMarksheetUrls, setAddMarksheetUrls] = useState<string[]>([]);
  const [addMarksheetNames, setAddMarksheetNames] = useState<string[]>([]);
  const [uploadingAadhar, setUploadingAadhar] = useState(false);
  const [uploadingMarksheet, setUploadingMarksheet] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

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

  const fetchLeaveBalance = async (employeeId: string) => {
    setLoadingBalance(true);
    try {
      const { data, error } = await supabase
        .from("leave_balances")
        .select("annual, sick, casual")
        .eq("user_id", employeeId)
        .maybeSingle();

      if (!error && data) {
        setLeaveBalance(data as LeaveBalance);
      } else {
        console.log(
          "Leave balance fetch error:",
          error,
          "for employee:",
          employeeId,
        );
        setLeaveBalance(null);
      }
    } catch (e) {
      console.log("Error fetching leave balance:", e);
      setLeaveBalance(null);
    }
    setLoadingBalance(false);
  };

  const uploadFile = async (
    fileUri: string,
    fileName: string,
    mimeType: string,
    folder: string,
  ): Promise<string | null> => {
    try {
      const fileExt = fileName.split(".").pop();
      const filePath = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error } = await supabase.storage
        .from("employee-documents")
        .upload(filePath, decode(base64), { contentType: mimeType });

      if (error) {
        console.log("Upload error:", error);
        return null;
      }

      const { data } = supabase.storage
        .from("employee-documents")
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (e) {
      console.log("Upload exception:", e);
      return null;
    }
  };

  const pickAadhar = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];

      if (file.size && file.size > 5 * 1024 * 1024) {
        Alert.alert("File too large", "Aadhar file must be under 5MB.");
        return;
      }

      setUploadingAadhar(true);
      const url = await uploadFile(
        file.uri,
        file.name,
        file.mimeType || "application/pdf",
        "aadhar",
      );
      if (url) {
        setAddAadharUrl(url);
        setAddAadharName(file.name);
      } else {
        Alert.alert("Upload failed", "Could not upload Aadhar card.");
      }
      setUploadingAadhar(false);
    } catch (e) {
      console.log("Aadhar pick error:", e);
      setUploadingAadhar(false);
    }
  };

  const pickMarksheet = async () => {
    if (addMarksheetUrls.length >= 3) {
      Alert.alert("Limit reached", "Maximum 3 marksheets allowed.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];

      if (file.size && file.size > 5 * 1024 * 1024) {
        Alert.alert("File too large", "Marksheet must be under 5MB.");
        return;
      }

      setUploadingMarksheet(true);
      const url = await uploadFile(
        file.uri,
        file.name,
        file.mimeType || "application/pdf",
        "marksheets",
      );
      if (url) {
        setAddMarksheetUrls((prev) => [...prev, url]);
        setAddMarksheetNames((prev) => [...prev, file.name]);
      } else {
        Alert.alert("Upload failed", "Could not upload marksheet.");
      }
      setUploadingMarksheet(false);
    } catch (e) {
      console.log("Marksheet pick error:", e);
      setUploadingMarksheet(false);
    }
  };

  const removeMarksheet = (index: number) => {
    setAddMarksheetUrls((prev) => prev.filter((_, i) => i !== index));
    setAddMarksheetNames((prev) => prev.filter((_, i) => i !== index));
  };

  const resetAddForm = () => {
    setAddName("");
    setAddEmail("");
    setAddPhone("");
    setAddDob("");
    setAddRole("Employee");
    setAddDepartment("");
    setAddDesignation("");
    setAddJoiningDate("");
    setAddAadharUrl(null);
    setAddAadharName("");
    setAddMarksheetUrls([]);
    setAddMarksheetNames([]);
  };

  const addEmployee = async () => {
    if (!addName.trim()) {
      Alert.alert("Error", "Name is required.");
      return;
    }
    if (!addEmail.trim()) {
      Alert.alert("Error", "Email is required.");
      return;
    }

    setAddSaving(true);
    try {
      //Insert into employees table directly (no auth user creation - admin manually adds profile)
      const { data, error } = await supabase
        .from("employees")
        .insert({
          id: Crypto.randomUUID(),
          full_name: addName.trim(),
          email: addEmail.trim(),
          phone: addPhone.trim() || null,
          dob: addDob.trim() || null,
          role: addRole,
          department: addDepartment.trim() || null,
          designation: addDesignation.trim() || null,
          joining_date: addJoiningDate.trim() || null,
          aadhar_url: addAadharUrl || null,
          marksheet_urls: addMarksheetUrls.length > 0 ? addMarksheetUrls : null,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setEmployees((prev) => [data as Employee, ...prev]);
        setAddModalVisible(false);
        resetAddForm();
      }
    } catch (e: any) {
      console.log("Error adding employee:", e);
      Alert.alert("Error", e.message || "Failed to add employee.");
    }
    setAddSaving(false);
  };

  const deactivateEmployee = async (emp: Employee) => {
    Alert.alert(
      emp.deactivated_at ? "Reactivate Employee" : "Deactivate Employee",
      emp.deactivated_at
        ? `Reactivate ${emp.full_name}? They will appear in the active list again.`
        : `Deactivate ${emp.full_name}? Thier data will be kept but they wont appear in the active list.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: emp.deactivated_at ? "Reactivate" : "Deactivate",
          style: emp.deactivated_at ? "default" : "destructive",
          onPress: async () => {
            try {
              const now = emp.deactivated_at ? null : new Date().toISOString();
              const newStatus = emp.deactivated_at ? "active" : "inactive";
              const { error } = await supabase
                .from("employees")
                .update({ deactivated_at: now, status: newStatus })
                .eq("id", emp.id);

              if (error) throw error;

              setEmployees((prev) =>
                prev.map((e) =>
                  e.id === emp.id
                    ? { ...e, deactivated_at: now, status: newStatus }
                    : e,
                ),
              );
              setDetailModalVisible(false);
            } catch (e) {
              console.log("Error deactivating employee:", e);
            }
          },
        },
      ],
    );
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const openDetail = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDetailModalVisible(true);
    if (isAdmin) fetchLeaveBalance(emp.id);
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
    const matchSearch =
      name.includes(search) || dept.includes(search) || desig.includes(search);
    const matchActive = showInactive
      ? e.status === "inactive"
      : e.status !== "inactive";
    return matchSearch && matchActive;
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
      {/* Add Employee Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setAddModalVisible(false);
          resetAddForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add Employee
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setAddModalVisible(false);
                  resetAddForm();
                }}
              >
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Full Name *
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
                placeholder="Full name"
                placeholderTextColor={colors.subtext}
                value={addName}
                onChangeText={setAddName}
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Email *
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
                placeholder="Email address"
                placeholderTextColor={colors.subtext}
                value={addEmail}
                onChangeText={setAddEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

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
                placeholder="Phone number"
                placeholderTextColor={colors.subtext}
                value={addPhone}
                onChangeText={setAddPhone}
                keyboardType="phone-pad"
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Date of Birth
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
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.subtext}
                value={addDob}
                onChangeText={setAddDob}
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Role
              </Text>
              <View style={{ flexDirection: "row", marginBottom: 16 }}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.chipOption,
                      { borderColor: colors.border },
                      addRole === r && styles.chipOptionActive,
                    ]}
                    onPress={() => setAddRole(r)}
                  >
                    <Text
                      style={[
                        styles.chipOptionText,
                        { color: addRole === r ? "#fff" : colors.subtext },
                      ]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Department
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {DEPARTMENTS.map((dept) => (
                  <TouchableOpacity
                    key={dept}
                    style={[
                      styles.chipOption,
                      { borderColor: colors.border },
                      addDepartment === dept && styles.chipOptionActive,
                    ]}
                    onPress={() => setAddDepartment(dept)}
                  >
                    <Text
                      style={[
                        styles.chipOptionText,
                        {
                          color:
                            addDepartment === dept ? "#fff" : colors.subtext,
                        },
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
                style={{ marginBottom: 16 }}
              >
                {DESIGNATIONS.map((desig) => (
                  <TouchableOpacity
                    key={desig}
                    style={[
                      styles.chipOption,
                      { borderColor: colors.border },
                      addDesignation === desig && styles.chipOptionActive,
                    ]}
                    onPress={() => setAddDesignation(desig)}
                  >
                    <Text
                      style={[
                        styles.chipOptionText,
                        {
                          color:
                            addDesignation === desig ? "#fff" : colors.subtext,
                        },
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
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.subtext}
                value={addJoiningDate}
                onChangeText={setAddJoiningDate}
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Aadhar Card
              </Text>
              <TouchableOpacity
                style={[
                  styles.uploadBtn,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
                onPress={pickAadhar}
                disabled={uploadingAadhar}
              >
                <Text style={[styles.uploadBtnText, { color: colors.subtext }]}>
                  {uploadingAadhar
                    ? "Uploading..."
                    : addAadharName ||
                      "📎 Upload Aadhar (JPG/PNG/PDF, max 5MB)"}
                </Text>
              </TouchableOpacity>
              {addAadharUrl && (
                <Text style={[styles.uploadedTag, { color: "#2e7d32" }]}>
                  ✓ Uploaded
                </Text>
              )}

              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.subtext, marginTop: 12 },
                ]}
              >
                Marksheets (max 3)
              </Text>
              {addMarksheetNames.map((name, i) => (
                <View key={i} style={styles.marksheetRow}>
                  <Text
                    style={[styles.marksheetName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    📄 {name}
                  </Text>
                  <TouchableOpacity onPress={() => removeMarksheet(i)}>
                    <Text style={{ color: "#c62828", fontWeight: "bold" }}>
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              {addMarksheetUrls.length < 3 && (
                <TouchableOpacity
                  style={[
                    styles.uploadBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                  onPress={pickMarksheet}
                  disabled={uploadingMarksheet}
                >
                  <Text
                    style={[styles.uploadBtnText, { color: colors.subtext }]}
                  >
                    {uploadingMarksheet
                      ? "Uploading..."
                      : "📎 Add Marksheet (JPG/PNG/PDF, max 5MB)"}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.editBtn,
                  { backgroundColor: "#6200ee", marginTop: 20 },
                  addSaving && { opacity: 0.6 },
                ]}
                onPress={addEmployee}
                disabled={addSaving}
              >
                <Text style={styles.editBtnText}>
                  {addSaving ? "Saving..." : "Add Employee"}
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
                  <View
                    style={[
                      styles.detailCard,
                      { backgroundColor: colors.card },
                    ]}
                  >
                    <Text
                      style={[
                        styles.detailLabel,
                        { color: colors.subtext, marginBottom: 10 },
                      ]}
                    >
                      Leave Balance
                    </Text>
                    {loadingBalance ? (
                      <ActivityIndicator size="small" color="#6200ee" />
                    ) : leaveBalance ? (
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        {[
                          { label: "Annual", value: leaveBalance.annual },
                          { label: "Sick", value: leaveBalance.sick },
                          { label: "Casual", value: leaveBalance.casual },
                        ].map(({ label, value }) => (
                          <View
                            key={label}
                            style={{ alignItems: "center", flex: 1 }}
                          >
                            <Text
                              style={{
                                fontSize: 22,
                                fontWeight: "bold",
                                color: "#6200ee",
                              }}
                            >
                              {value}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: colors.subtext,
                                marginTop: 2,
                              }}
                            >
                              {label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text
                        style={[styles.detailValue, { color: colors.subtext }]}
                      >
                        No balance record
                      </Text>
                    )}
                  </View>
                )}

                {isAdmin && (
                  <>
                    {/*Documents section */}
                    {(selectedEmployee.aadhar_url ||
                      (selectedEmployee.marksheet_urls &&
                        selectedEmployee.marksheet_urls.length > 0)) && (
                      <View
                        style={[
                          styles.detailCard,
                          { backgroundColor: colors.card },
                        ]}
                      >
                        <Text
                          style={[
                            styles.detailLabel,
                            { color: colors.subtext, marginBottom: 10 },
                          ]}
                        >
                          Documents
                        </Text>
                        {selectedEmployee.aadhar_url && (
                          <TouchableOpacity
                            style={styles.docLink}
                            onPress={() =>
                              Linking.openURL(selectedEmployee.aadhar_url!)
                            }
                          >
                            <Text style={styles.docLinkText}> Aadhar cARD</Text>
                          </TouchableOpacity>
                        )}
                        {selectedEmployee.marksheet_urls?.map((url, i) => (
                          <TouchableOpacity
                            key={i}
                            style={styles.docLink}
                            onPress={() => Linking.openURL(url)}
                          >
                            <Text style={styles.docLinkText}>
                              Marksheet {i + 1}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.editBtn, { backgroundColor: "#6200ee" }]}
                      onPress={() => openEdit(selectedEmployee)}
                    >
                      <Text style={styles.editBtnText}>Edit Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.editBtn,
                        {
                          backgroundColor: selectedEmployee.deactivated_at
                            ? "#e8f5e9"
                            : "#ffebee",
                          marginTop: -8,
                        },
                      ]}
                      onPress={() => deactivateEmployee(selectedEmployee)}
                    >
                      <Text
                        style={[
                          styles.editBtnText,
                          {
                            color: selectedEmployee.deactivated_at
                              ? "#2e7d32"
                              : "#c62828",
                          },
                        ]}
                      >
                        {selectedEmployee.deactivated_at
                          ? "Reactivate Employee"
                          : "Deactivate Employee"}
                      </Text>
                    </TouchableOpacity>
                  </>
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
        {isAdmin && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              style={[
                styles.filterToggle,
                { borderColor: showInactive ? "#c62828" : colors.border },
              ]}
              onPress={() => setShowInactive(!showInactive)}
            >
              <Text
                style={[
                  styles.filterToggleText,
                  { color: showInactive ? "#c62828" : colors.subtext },
                ]}
              >
                {showInactive ? "Inactive" : "Active"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setAddModalVisible(true)}
            >
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 28,
  },
  filterToggle: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterToggleText: { fontSize: 12, fontWeight: "600" },
  uploadBtn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  uploadBtnText: { fontSize: 13 },
  uploadedTag: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  marksheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  marksheetName: { flex: 1, fontSize: 13, marginRight: 8 },
  docLink: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },
  docLinkText: { fontSize: 14, color: "#6200ee", fontWeight: "600" },
});
