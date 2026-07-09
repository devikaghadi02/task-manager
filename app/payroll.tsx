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

type PayrollEntry = {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  notes: string | null;
  created_at: string;
  employee_name?: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function PayrollScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [employeePickerVisible, setEmployeePickerVisible] = useState(false);

  // Form state
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formEmployeeName, setFormEmployeeName] = useState("");
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
  const [formYear, setFormYear] = useState(currentYear);
  const [formBasic, setFormBasic] = useState("");
  const [formAllowances, setFormAllowances] = useState("");
  const [formDeductions, setFormDeductions] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const admin = user.email === "admin@test.com";
      setIsAdmin(admin);

      const query = supabase
        .from("payroll")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });

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

          setEntries(
            data.map((d: any) => ({
              ...d,
              employee_name: empMap[d.employee_id] || "Unknown",
            })),
          );
        } else {
          setEntries(data as PayrollEntry[]);
        }
      }
    } catch (e) {
      console.log("Error fetching payroll:", e);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const addEntry = async () => {
    if (!formEmployeeId) {
      Alert.alert("Error", "Please select an employee.");
      return;
    }
    if (!formBasic.trim()) {
      Alert.alert("Error", "Basic salary is required.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("payroll")
        .insert({
          employee_id: formEmployeeId,
          month: formMonth,
          year: formYear,
          basic_salary: parseFloat(formBasic) || 0,
          allowances: parseFloat(formAllowances) || 0,
          deductions: parseFloat(formDeductions) || 0,
          notes: formNotes.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (!error && data) {
        setEntries([{ ...data, employee_name: formEmployeeName }, ...entries]);
        setAddModalVisible(false);
        resetForm();
      }
    } catch (e) {
      console.log("Error adding payroll:", e);
    }
    setSaving(false);
  };

  const deleteEntry = async (id: string) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this payroll entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.from("payroll").delete().eq("id", id);
              setEntries(entries.filter((e) => e.id !== id));
              setDetailModalVisible(false);
            } catch (e) {
              console.log("Error deleting entry:", e);
            }
          },
        },
      ],
    );
  };

  const resetForm = () => {
    setFormEmployeeId("");
    setFormEmployeeName("");
    setFormMonth(new Date().getMonth() + 1);
    setFormYear(currentYear);
    setFormBasic("");
    setFormAllowances("");
    setFormDeductions("");
    setFormNotes("");
  };

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const netSalary =
    (parseFloat(formBasic) || 0) +
    (parseFloat(formAllowances) || 0) -
    (parseFloat(formDeductions) || 0);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Employee Picker */}
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
                    setFormEmployeeId(item.id);
                    setFormEmployeeName(item.name);
                    setEmployeePickerVisible(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  {formEmployeeId === item.id && (
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

      {/* Add Payroll Modal */}
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
                Add Payroll Entry
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
                  style={{
                    color: formEmployeeId ? colors.text : colors.subtext,
                    fontSize: 15,
                  }}
                >
                  {formEmployeeName || "Select employee..."}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Month
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {MONTHS.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      formMonth === i + 1 && styles.chipActive,
                    ]}
                    onPress={() => setFormMonth(i + 1)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: formMonth === i + 1 ? "#fff" : colors.subtext,
                        },
                      ]}
                    >
                      {m.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Year
              </Text>
              <View style={styles.yearRow}>
                {YEARS.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      formYear === y && styles.chipActive,
                    ]}
                    onPress={() => setFormYear(y)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: formYear === y ? "#fff" : colors.subtext },
                      ]}
                    >
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Basic Salary (₹)
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
                placeholder="0.00"
                placeholderTextColor={colors.subtext}
                value={formBasic}
                onChangeText={setFormBasic}
                keyboardType="numeric"
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Allowances (₹)
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
                placeholder="0.00"
                placeholderTextColor={colors.subtext}
                value={formAllowances}
                onChangeText={setFormAllowances}
                keyboardType="numeric"
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Deductions (₹)
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
                placeholder="0.00"
                placeholderTextColor={colors.subtext}
                value={formDeductions}
                onChangeText={setFormDeductions}
                keyboardType="numeric"
              />

              {/* Live net salary preview */}
              <View
                style={[
                  styles.netPreview,
                  { backgroundColor: colors.card, borderColor: "#6200ee" },
                ]}
              >
                <Text
                  style={[styles.netPreviewLabel, { color: colors.subtext }]}
                >
                  Net Salary
                </Text>
                <Text style={styles.netPreviewAmount}>
                  {formatCurrency(netSalary)}
                </Text>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
                Notes (Optional)
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
                placeholder="e.g. Includes performance bonus..."
                placeholderTextColor={colors.subtext}
                value={formNotes}
                onChangeText={setFormNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                onPress={addEntry}
                disabled={saving}
              >
                <Text style={styles.submitBtnText}>
                  {saving ? "Saving..." : "Save Payroll Entry"}
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
                Pay Slip
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {selectedEntry && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.payslipPeriod, { color: colors.text }]}>
                  {MONTHS[selectedEntry.month - 1]} {selectedEntry.year}
                </Text>
                {isAdmin && (
                  <Text
                    style={[styles.payslipEmployee, { color: colors.subtext }]}
                  >
                    {selectedEntry.employee_name}
                  </Text>
                )}

                <View
                  style={[styles.payslipCard, { backgroundColor: colors.card }]}
                >
                  {[
                    {
                      label: "Basic Salary",
                      value: formatCurrency(selectedEntry.basic_salary),
                      color: colors.text,
                    },
                    {
                      label: "Allowances",
                      value: `+ ${formatCurrency(selectedEntry.allowances)}`,
                      color: "#2e7d32",
                    },
                    {
                      label: "Deductions",
                      value: `- ${formatCurrency(selectedEntry.deductions)}`,
                      color: "#c62828",
                    },
                  ].map(({ label, value, color }) => (
                    <View
                      key={label}
                      style={[
                        styles.payslipRow,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[styles.payslipLabel, { color: colors.subtext }]}
                      >
                        {label}
                      </Text>
                      <Text style={[styles.payslipValue, { color }]}>
                        {value}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.netRow}>
                    <Text style={[styles.netLabel, { color: colors.text }]}>
                      Net Salary
                    </Text>
                    <Text style={styles.netAmount}>
                      {formatCurrency(selectedEntry.net_salary)}
                    </Text>
                  </View>
                </View>

                {selectedEntry.notes && (
                  <View
                    style={[
                      styles.notesCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.notesLabel, { color: colors.subtext }]}
                    >
                      Notes
                    </Text>
                    <Text style={[styles.notesText, { color: colors.text }]}>
                      {selectedEntry.notes}
                    </Text>
                  </View>
                )}

                <Text style={[styles.addedOn, { color: colors.subtext }]}>
                  Added on{" "}
                  {new Date(selectedEntry.created_at).toLocaleDateString()}
                </Text>

                {isAdmin && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deleteEntry(selectedEntry.id)}
                  >
                    <Text style={styles.deleteBtnText}>Delete Entry</Text>
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
        <Text style={[styles.title, { color: colors.text }]}>Payroll</Text>
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

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => {
              setSelectedEntry(item);
              setDetailModalVisible(true);
            }}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.monthBadge, { backgroundColor: "#6200ee" }]}>
                <Text style={styles.monthBadgeText}>
                  {MONTHS[item.month - 1].slice(0, 3)}
                </Text>
                <Text style={styles.yearBadgeText}>{item.year}</Text>
              </View>
              <View style={styles.cardInfo}>
                {isAdmin && (
                  <Text
                    style={[styles.cardEmployee, { color: colors.subtext }]}
                  >
                    {item.employee_name}
                  </Text>
                )}
                <Text style={[styles.cardNet, { color: colors.text }]}>
                  {formatCurrency(item.net_salary)}
                </Text>
                <Text style={[styles.cardBreakdown, { color: colors.subtext }]}>
                  Basic {formatCurrency(item.basic_salary)} · +
                  {formatCurrency(item.allowances)} · -
                  {formatCurrency(item.deductions)}
                </Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              No payroll entries yet.
            </Text>
            {isAdmin && (
              <Text style={[styles.emptyHint, { color: colors.subtext }]}>
                Tap "+ Add" to add a payroll entry.
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
  monthBadge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  monthBadgeText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  yearBadgeText: { color: "rgba(255,255,255,0.8)", fontSize: 10 },
  cardInfo: { flex: 1 },
  cardEmployee: { fontSize: 11, marginBottom: 2 },
  cardNet: { fontSize: 16, fontWeight: "bold" },
  cardBreakdown: { fontSize: 11, marginTop: 2 },
  chevron: { fontSize: 22 },
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
  modalTitle: { fontSize: 18, fontWeight: "bold" },
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
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#6200ee", borderColor: "#6200ee" },
  chipText: { fontSize: 12, fontWeight: "500" },
  yearRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  netPreview: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  netPreviewLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  netPreviewAmount: { fontSize: 28, fontWeight: "bold", color: "#6200ee" },
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
  payslipPeriod: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  payslipEmployee: { fontSize: 13, marginBottom: 16 },
  payslipCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  payslipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  payslipLabel: { fontSize: 13, fontWeight: "500" },
  payslipValue: { fontSize: 14, fontWeight: "600" },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 14,
  },
  netLabel: { fontSize: 16, fontWeight: "bold" },
  netAmount: { fontSize: 20, fontWeight: "bold", color: "#6200ee" },
  notesCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  notesLabel: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  notesText: { fontSize: 14 },
  addedOn: { fontSize: 12, marginBottom: 16 },
  deleteBtn: {
    backgroundColor: "#ffebee",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  deleteBtnText: { color: "#c62828", fontWeight: "700", fontSize: 15 },
});
