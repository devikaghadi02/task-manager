import { createContext, ReactNode, useContext, useState } from "react";

type ThemeContextType = {
  isDark: boolean;
  toggleDark: () => void;
  colors: {
    background: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
  };
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleDark: () => {},
  colors: {
    background: "#f5f5f5",
    card: "#ffffff",
    text: "#333333",
    subtext: "#888888",
    border: "#eeeeee",
  },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  const toggleDark = () => setIsDark((prev) => !prev);

  const colors = isDark
    ? {
        background: "#121212",
        card: "#1e1e1e",
        text: "#ffffff",
        subtext: "#aaaaaa",
        border: "#333333",
      }
    : {
        background: "#f5f5f5",
        card: "#ffffff",
        text: "#333333",
        subtext: "#888888",
        border: "#eeeeee",
      };

  return (
    <ThemeContext.Provider value={{ isDark, toggleDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
