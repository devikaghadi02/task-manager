import { useFocusEffect } from "@react-navigation/native";
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

type Document = {
  id: string;
  employee_id: string;
  title: string;
  type: string;
  url: string;
  description: string | null;
  created_at: string;
  employee_name?: string;
};

const DOC_TYPES = [
  "Offer Letter",
  "Policy",
  "Contract",
  "Payslip",
  "ID Proof",
  "Certificate",
  "Other",
];

const getTypeColor = (type: string) => {
  switch (type) {
    case "Offer Letter":
      return "#1976d2";
    case "Policy":
      return "#6200ee";
    case "Contract":
      return "#2e7d32";
    case "Payslip":
      return "#f9a825";
    case "ID Proof":
      return "#e65100";
    case "Certificate":
      return "#c62828";
    default:
      return "#9e9e9e";
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "Offer Letter":
      return "📄";
    case "Policy":
      return "📋";
    case "Contract":
      return "📝";
    case "Payslip":
      return "💰";
    case "ID Proof":
      return "🪪";
    case "Certificate":
      return "🏆";
    default:
      return "📁";
  }
};

export default function DocumentsScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedType, setSelectedType] = useState("All");

  // Add form state
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("Offer Letter");
  const [docUrl, setDocUrl] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [docEmployeeId, setDocEmployeeId] = useState("");
  const [docEmployeeName, setDocEmployeeName] = useState("");
  const [employeePickerVisible, setEmployeePickerVisible] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const admin = user.email === "admin@test.com";
      setIsAdmin(admin);

      // Fetch documents
      const query = supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      const { data, error } = admin
        ? await query
        : await query.eq("employee_id", user.id);

      if (!error && data) {
        if (admin) {
          const { data: emps } = await supabase
            .from("employees")
            .select("id, full_name, email");

          const empMap: { [key: string]: string } = {};
          if (emps) {
            emps.forEach((e: any) => {
              empMap[e.id] = e.full_name || e.email?.split("@")[0] || "Unknown";
            });
            setEmployees(
              emps.map((e: any) => ({
                id: e.id,
                name: e.full_name || e.email?.split("@")[0] || "Unknown",
              })),
            );
          }

          setDocuments(
            data.map((d: any) => ({
              ...d,
              employee_name: empMap[d.employee_id] || "Unknown",
            })),
          );
        } else {
          setDocuments(data as Document[]);
        }
      }
    } catch (e) {
      console.log("Error fetching documents:", e);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const addDocument = async () => {
    if (!docTitle.trim()) {
      Alert.alert("Error", "Title is required.");
      return;
    }
    if (!docUrl.trim()) {
      Alert.alert("Error", "URL is required.");
      return;
    }
    if (!docEmployeeId) {
      Alert.alert("Error", "Please select an employee.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("documents")
        .insert({
          employee_id: docEmployeeId,
          title: docTitle.trim(),
          type: docType,
          url: docUrl.trim(),
          description: docDescription.trim() || null,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (!error && data) {
        setDocuments([
          {
            ...data,
            employee_name: docEmployeeName,
          },
          ...documents,
        ]);
        setAddModalVisible(false);
        resetForm();
      }
    } catch (e) {
      console.log("Error adding document:", e);
    }
    setSaving(false);
  };

  const deleteDocument = async (id: string) => {
    Alert.alert(
      "Delete Document",
      "Are you sure you want to delete this document?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.from("documents").delete().eq("id", id);
              setDocuments(documents.filter((d) => d.id !== id));
              setDetailModalVisible(false);
            } catch (e) {
              console.log("Error deleting document:", e);
            }
          },
        },
      ],
    );
  };

  const openDocument = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Error",
          "Cannot open this URL. Make sure it starts with http:// or https://",
        );
      }
    } catch (e) {
      Alert.alert("Error", "Failed to open document.");
    }
  };

  const resetForm = () => {
    setDocTitle("");
    setDocType("Offer Letter");
    setDocUrl("");
    setDocDescription("");
    setDocEmployeeId("");
    setDocEmployeeName("");
  };

  const filteredDocs = documents.filter((d) => {
    const matchSearch =
      d.title.toLowerCase().includes(searchText.toLowerCase()) ||
      (d.employee_name?.toLowerCase() || "").includes(searchText.toLowerCase());
    const matchType = selectedType === "All" || d.type === selectedType;
    return matchSearch && matchType;
  });

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Employee Picker Modal */}
      <Modal
        visible={employeePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmployeePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select Employee
              </Text>
              <TouchableOpacity onPress={() => setEmployeePickerVisible(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={employees}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerRow,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => {
                    setDocEmployeeId(item.id);
                    setDocEmployeeName(item.name);
                    setEmployeePickerVisible(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  {docEmployeeId === item.id && (
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

      {/* Add Document Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add Document
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setAddModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Employee
              </Text>
              <TouchableOpacity
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    justifyContent: "center",
                  },
                ]}
                onPress={() => setEmployeePickerVisible(true)}
              >
                <Text
                  style={[
                    {
                      color: docEmployeeId ? colors.text : colors.subtext,
                      fontSize: 15,
                    },
                  ]}
                >
                  {docEmployeeName || "Select employee..."}
                </Text>
              </TouchableOpacity>

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
                placeholder="e.g. Offer Letter Jan 2025"
                placeholderTextColor={colors.subtext}
                value={docTitle}
                onChangeText={setDocTitle}
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Document Type
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {DOC_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      docType === type && {
                        backgroundColor: "#6200ee",
                        borderColor: "#6200ee",
                      },
                    ]}
                    onPress={() => setDocType(type)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: docType === type ? "#fff" : colors.subtext },
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                URL / Link
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
                placeholder="https://drive.google.com/..."
                placeholderTextColor={colors.subtext}
                value={docUrl}
                onChangeText={setDocUrl}
                keyboardType="url"
                autoCapitalize="none"
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Description (Optional)
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
                placeholder="Brief description..."
                placeholderTextColor={colors.subtext}
                value={docDescription}
                onChangeText={setDocDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                onPress={addDocument}
                disabled={saving}
              >
                <Text style={styles.submitBtnText}>
                  {saving ? "Saving..." : "Add Document"}
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
              <Text
                style={[styles.modalTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {selectedDoc?.title}
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {selectedDoc && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.docIconWrap}>
                  <Text style={styles.docIconLarge}>
                    {getTypeIcon(selectedDoc.type)}
                  </Text>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor: getTypeColor(selectedDoc.type) + "22",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        { color: getTypeColor(selectedDoc.type) },
                      ]}
                    >
                      {selectedDoc.type}
                    </Text>
                  </View>
                </View>

                {isAdmin && (
                  <Text
                    style={[styles.detailEmployee, { color: colors.subtext }]}
                  >
                    Employee: {selectedDoc.employee_name}
                  </Text>
                )}

                {selectedDoc.description && (
                  <Text
                    style={[styles.detailDescription, { color: colors.text }]}
                  >
                    {selectedDoc.description}
                  </Text>
                )}

                <Text style={[styles.detailDate, { color: colors.subtext }]}>
                  Added on{" "}
                  {new Date(selectedDoc.created_at).toLocaleDateString()}
                </Text>

                <TouchableOpacity
                  style={styles.openBtn}
                  onPress={() => openDocument(selectedDoc.url)}
                >
                  <Text style={styles.openBtnText}>🔗 Open Document</Text>
                </TouchableOpacity>

                {isAdmin && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deleteDocument(selectedDoc.id)}
                  >
                    <Text style={styles.deleteBtnText}>Delete Document</Text>
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
        <Text style={[styles.title, { color: colors.text }]}>Documents</Text>
        {isAdmin ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModalVisible(true)}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {/* Search */}
      <TextInput
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        placeholder="Search documents..."
        placeholderTextColor={colors.subtext}
        value={searchText}
        onChangeText={setSearchText}
      />

      {/* Type filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12, flexGrow: 0 }}
      >
        {["All", ...DOC_TYPES].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.chip,
              { borderColor: colors.border },
              selectedType === type && {
                backgroundColor: "#6200ee",
                borderColor: "#6200ee",
              },
            ]}
            onPress={() => setSelectedType(type)}
          >
            <Text
              style={[
                styles.chipText,
                { color: selectedType === type ? "#fff" : colors.subtext },
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredDocs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => {
              setSelectedDoc(item);
              setDetailModalVisible(true);
            }}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.cardIcon}>{getTypeIcon(item.type)}</Text>
              <View style={styles.cardInfo}>
                <Text
                  style={[styles.cardTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {isAdmin && (
                  <Text
                    style={[styles.cardEmployee, { color: colors.subtext }]}
                  >
                    {item.employee_name}
                  </Text>
                )}
                {item.description && (
                  <Text
                    style={[styles.cardDesc, { color: colors.subtext }]}
                    numberOfLines={1}
                  >
                    {item.description}
                  </Text>
                )}
              </View>
            </View>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: getTypeColor(item.type) + "22" },
              ]}
            >
              <Text
                style={[
                  styles.typeBadgeText,
                  { color: getTypeColor(item.type) },
                ]}
              >
                {item.type}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              No documents found.
            </Text>
            {isAdmin && (
              <Text style={[styles.emptyHint, { color: colors.subtext }]}>
                Tap "+ Add" to upload a document link.
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
    marginBottom: 16,
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
  searchBar: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipText: { fontSize: 12, fontWeight: "500" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  cardIcon: { fontSize: 28, marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  cardEmployee: { fontSize: 11, marginTop: 2 },
  cardDesc: { fontSize: 11, marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  typeBadgeText: { fontSize: 10, fontWeight: "700" },
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
    maxHeight: "90%",
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
    minHeight: 80,
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
  pickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  pickerRowText: { fontSize: 15, fontWeight: "500" },
  docIconWrap: { alignItems: "center", marginBottom: 16 },
  docIconLarge: { fontSize: 48, marginBottom: 8 },
  detailEmployee: { fontSize: 13, marginBottom: 8 },
  detailDescription: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  detailDate: { fontSize: 12, marginBottom: 20 },
  openBtn: {
    backgroundColor: "#6200ee",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  openBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  deleteBtn: {
    backgroundColor: "#ffebee",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  deleteBtnText: { color: "#c62828", fontWeight: "700", fontSize: 15 },
});
