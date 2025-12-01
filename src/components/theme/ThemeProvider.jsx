import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext({
  theme: "light",
  setTheme: () => {},
  customColors: {},
  setCustomColors: () => {}
});

export const useTheme = () => useContext(ThemeContext);

export const THEMES = {
  light: {
    name: "Light",
    description: "Bright backgrounds with dark text. Good for well-lit environments.",
    icon: "sun",
    colors: {
      background: "#ffffff",
      foreground: "#0f172a",
      card: "#ffffff",
      cardForeground: "#0f172a",
      primary: "#4f46e5",
      primaryForeground: "#ffffff",
      secondary: "#f1f5f9",
      secondaryForeground: "#0f172a",
      muted: "#f1f5f9",
      mutedForeground: "#64748b",
      accent: "#f1f5f9",
      accentForeground: "#0f172a",
      border: "#e2e8f0",
      ring: "#4f46e5"
    }
  },
  dark: {
    name: "Dark",
    description: "Dark backgrounds with light text. Reduces eye strain in low-light.",
    icon: "moon",
    colors: {
      background: "#0f172a",
      foreground: "#f8fafc",
      card: "#1e293b",
      cardForeground: "#f8fafc",
      primary: "#818cf8",
      primaryForeground: "#0f172a",
      secondary: "#334155",
      secondaryForeground: "#f8fafc",
      muted: "#334155",
      mutedForeground: "#94a3b8",
      accent: "#334155",
      accentForeground: "#f8fafc",
      border: "#334155",
      ring: "#818cf8"
    }
  },
  highContrast: {
    name: "High Contrast",
    description: "Strong color differences for visual accessibility. WCAG-compliant.",
    icon: "contrast",
    colors: {
      background: "#000000",
      foreground: "#ffffff",
      card: "#000000",
      cardForeground: "#ffffff",
      primary: "#ffff00",
      primaryForeground: "#000000",
      secondary: "#000000",
      secondaryForeground: "#ffffff",
      muted: "#1a1a1a",
      mutedForeground: "#ffffff",
      accent: "#00ffff",
      accentForeground: "#000000",
      border: "#ffffff",
      ring: "#ffff00"
    }
  },
  system: {
    name: "System / Auto",
    description: "Automatically matches your device's light or dark mode setting.",
    icon: "monitor",
    colors: null // Will use light or dark based on system
  },
  minimalist: {
    name: "Minimalist",
    description: "Clean, simple UI with neutral colors and lots of whitespace.",
    icon: "minus",
    colors: {
      background: "#fafafa",
      foreground: "#171717",
      card: "#ffffff",
      cardForeground: "#171717",
      primary: "#525252",
      primaryForeground: "#fafafa",
      secondary: "#f5f5f5",
      secondaryForeground: "#171717",
      muted: "#f5f5f5",
      mutedForeground: "#737373",
      accent: "#e5e5e5",
      accentForeground: "#171717",
      border: "#e5e5e5",
      ring: "#525252"
    }
  },
  vibrant: {
    name: "Colorful / Vibrant",
    description: "Bright, playful colors for creative and engaging experiences.",
    icon: "palette",
    colors: {
      background: "#fef3c7",
      foreground: "#1e1b4b",
      card: "#ffffff",
      cardForeground: "#1e1b4b",
      primary: "#dc2626",
      primaryForeground: "#ffffff",
      secondary: "#fce7f3",
      secondaryForeground: "#1e1b4b",
      muted: "#fef9c3",
      mutedForeground: "#4c1d95",
      accent: "#c4b5fd",
      accentForeground: "#1e1b4b",
      border: "#fcd34d",
      ring: "#dc2626"
    }
  },
  corporate: {
    name: "Corporate / Professional",
    description: "Neutral tones and formal typography for business applications.",
    icon: "briefcase",
    colors: {
      background: "#f8fafc",
      foreground: "#1e293b",
      card: "#ffffff",
      cardForeground: "#1e293b",
      primary: "#1e40af",
      primaryForeground: "#ffffff",
      secondary: "#e2e8f0",
      secondaryForeground: "#1e293b",
      muted: "#f1f5f9",
      mutedForeground: "#475569",
      accent: "#dbeafe",
      accentForeground: "#1e40af",
      border: "#cbd5e1",
      ring: "#1e40af"
    }
  },
  seasonal: {
    name: "Seasonal / Holiday",
    description: "Festive colors that change with the season. Currently: Winter.",
    icon: "sparkles",
    colors: {
      background: "#f0f9ff",
      foreground: "#0c4a6e",
      card: "#ffffff",
      cardForeground: "#0c4a6e",
      primary: "#0369a1",
      primaryForeground: "#ffffff",
      secondary: "#e0f2fe",
      secondaryForeground: "#0c4a6e",
      muted: "#bae6fd",
      mutedForeground: "#075985",
      accent: "#7dd3fc",
      accentForeground: "#0c4a6e",
      border: "#7dd3fc",
      ring: "#0369a1"
    }
  },
  accessible: {
    name: "Accessibility-Friendly",
    description: "Dyslexia-friendly fonts, larger text, and color-blind safe palettes.",
    icon: "accessibility",
    colors: {
      background: "#fffbeb",
      foreground: "#1c1917",
      card: "#ffffff",
      cardForeground: "#1c1917",
      primary: "#0369a1",
      primaryForeground: "#ffffff",
      secondary: "#fef3c7",
      secondaryForeground: "#1c1917",
      muted: "#fef3c7",
      mutedForeground: "#44403c",
      accent: "#bae6fd",
      accentForeground: "#1c1917",
      border: "#d6d3d1",
      ring: "#0369a1"
    },
    fontFamily: "OpenDyslexic, Comic Sans MS, sans-serif",
    fontSize: "18px"
  },
  custom: {
    name: "Custom Theme",
    description: "Create your own theme with custom colors and fonts.",
    icon: "settings",
    colors: null // Will use user-defined colors
  }
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const [customColors, setCustomColors] = useState({
    primary: "#4f46e5",
    background: "#ffffff",
    foreground: "#0f172a",
    accent: "#f1f5f9"
  });
  const [systemPreference, setSystemPreference] = useState("light");

  // Load saved theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("app-theme") || "light";
    const savedCustomColors = localStorage.getItem("app-custom-colors");
    
    setTheme(savedTheme);
    if (savedCustomColors) {
      setCustomColors(JSON.parse(savedCustomColors));
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPreference(mediaQuery.matches ? "dark" : "light");
    
    const handleChange = (e) => setSystemPreference(e.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);
    
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    
    let activeTheme = theme;
    if (theme === "system") {
      activeTheme = systemPreference;
    }
    
    // Get colors - fall back to light theme if theme doesn't exist or has no colors
    let colors = THEMES[activeTheme]?.colors || THEMES.light.colors;
    
    if (theme === "custom") {
      colors = {
        ...THEMES.light.colors,
        primary: customColors.primary,
        background: customColors.background,
        foreground: customColors.foreground,
        accent: customColors.accent,
        ring: customColors.primary
      };
    }

    if (colors) {
      Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });
    }

    // Apply special theme classes
    root.classList.remove("theme-light", "theme-dark", "theme-high-contrast", "theme-accessible");
    
    if (activeTheme === "dark" || theme === "highContrast") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (theme === "highContrast") {
      root.classList.add("theme-high-contrast");
    }

    if (theme === "accessible") {
      root.classList.add("theme-accessible");
      root.style.setProperty("--font-family", THEMES.accessible.fontFamily);
      root.style.setProperty("--base-font-size", THEMES.accessible.fontSize);
    } else {
      root.style.removeProperty("--font-family");
    }

    // Save to localStorage
    localStorage.setItem("app-theme", theme);
    
  }, [theme, customColors, systemPreference]);

  const handleSetTheme = (newTheme) => {
    setTheme(newTheme);
  };

  const handleSetCustomColors = (colors) => {
    setCustomColors(colors);
    localStorage.setItem("app-custom-colors", JSON.stringify(colors));
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme: handleSetTheme, 
      customColors, 
      setCustomColors: handleSetCustomColors,
      systemPreference 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;