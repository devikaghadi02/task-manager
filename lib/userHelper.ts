export const USER_FALLBACK_MAP: { [key: string]: { name: string; email: string } } = {
  "509961ca-70af-4bdf-ad7f-2914f162b4d4": { name: "Admin", email: "admin@test.com" },
  "ec14d5fc-65d9-4070-9555-dcafb729b3b2": { name: "Alice", email: "alice@test.com" },
  "14874cee-16c1-49c6-87e2-19c473aed1b4": { name: "Bob", email: "bob@test.com" },
  "c845c8cc-87f5-46d1-b4ea-464aac0b3633": { name: "Devika", email: "devika@test.com" },
  "fe2baf43-c091-4e22-9496-7ab7d8abd9bb": { name: "Test User", email: "user@test.com" },
};

export function getUserDisplayName(
  userId: string,
  profile?: { full_name?: string | null; email?: string | null } | null
): string {
  if (profile) {
    if (profile.full_name && profile.full_name.trim() !== "") {
      return profile.full_name;
    }
    if (profile.email && profile.email.trim() !== "") {
      const emailName = profile.email.split("@")[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
  }

  const fallback = USER_FALLBACK_MAP[userId];
  if (fallback) {
    return fallback.name;
  }

  return `User (${userId.substring(0, 8)})`;
}

const CATEGORY_COLORS: { [key: string]: string } = {
  work: "#7c4dff",       // Deep Purple
  personal: "#2196f3",   // Bright Blue
  shopping: "#4caf50",   // Green
  groceries: "#8bc34a",   // Light Green
  urgent: "#f44336",     // Red
  fitness: "#e91e63",    // Pink
  education: "#ff9800",  // Orange
};

export function getCategoryColor(category: string | null | undefined): string {
  if (!category) return "#9e9e9e"; // Default Grey
  const normalized = category.trim().toLowerCase();
  if (CATEGORY_COLORS[normalized]) {
    return CATEGORY_COLORS[normalized];
  }
  // Hash function to pick a consistent color for custom categories
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#e91e63", "#9c27b0", "#673ab7", "#3f51b5", "#2196f3",
    "#03a9f4", "#00bcd4", "#009688", "#4caf50", "#8bc34a",
    "#ff9800", "#ff5722"
  ];
  return colors[Math.abs(hash) % colors.length];
}
