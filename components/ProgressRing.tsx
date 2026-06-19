import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

type ProgressRingProps = {
  percentage: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  textColor?: string;
};

// A small circular progress indicator built on react-native-svg.
// No date filtering happens in here — it just renders whatever
// percentage it's handed, so the caller decides what "progress"
// means (today's tasks, all-time tasks, a single section, etc).
export default function ProgressRing({
  percentage,
  size = 40,
  strokeWidth = 4,
  color = "#2e7d32",
  trackColor = "#e0e0e0",
  textColor,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * clamped) / 100;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          stroke={trackColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc — rotated -90deg so it starts at 12 o'clock */}
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference}, ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.labelWrap}>
        <Text
          style={[
            styles.label,
            { color: textColor ?? color, fontSize: size * 0.28 },
          ]}
        >
          {Math.round(clamped)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  labelWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: "700",
  },
});
