import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export const ACCENT_COLORS = {
  Purple: "colors.accent",
  Blue: "#1976d2",
  Green: "#2e7d32",
  Orange: "#e65100",
  Pink: "#c2185b",
} as const;

const ACCENT_STORAGE_KEY = "accentColor";

type ThemeContextType = {
  isDark: boolean;
  toggleDark: () => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  colors: {
    background: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
    accent: string;
  };
};

const DEFAULT_ACCENT = ACCENT_COLORS.Purple;

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleDark: () => {},
  accentColor: DEFAULT_ACCENT,
  setAccentColor: () => {},
  colors: {
    background: "#f5f5f5",
    card: "#ffffff",
    text: "#333333",
    subtext: "#888888",
    border: "#eeeeee",
    accent: DEFAULT_ACCENT,
  },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    AsyncStorage.getItem(ACCENT_STORAGE_KEY).then((saved) => {
      if (saved) setAccentColorState(saved);
    });
  }, []);

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    AsyncStorage.setItem(ACCENT_STORAGE_KEY, color);
  };

  const toggleDark = () => setIsDark((prev) => !prev);

  const colors = isDark
    ? {
        background: "#121212",
        card: "#1e1e1e",
        text: "#ffffff",
        subtext: "#aaaaaa",
        border: "#333333",
        accent: accentColor,
      }
    : {
        background: "#f5f5f5",
        card: "#ffffff",
        text: "#333333",
        subtext: "#888888",
        border: "#eeeeee",
        accent: accentColor,
      };

  return (
    <ThemeContext.Provider
      value={{ isDark, toggleDark, accentColor, setAccentColor, colors }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
