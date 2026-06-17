import { useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity } from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
  onToggleComplete: () => void;
  isCompleted: boolean;
};

export default function SwipeableTask({
  children,
  onDelete,
  onToggleComplete,
  isCompleted,
}: Props) {
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipeable = () => {
    swipeableRef.current?.close();
  };

  // Shows on LEFT swipe → Delete (red)
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          closeSwipeable();
          onDelete();
        }}
      >
        <Animated.Text style={[styles.actionText, { transform: [{ scale }] }]}>
          Delete
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  // Shows on RIGHT swipe → Complete/Pending (green/yellow)
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        style={[
          styles.completeAction,
          { backgroundColor: isCompleted ? "#f9a825" : "#2e7d32" },
        ]}
        onPress={() => {
          closeSwipeable();
          onToggleComplete();
        }}
      >
        <Animated.Text style={[styles.actionText, { transform: [{ scale }] }]}>
          {isCompleted ? "Pending" : "Done"}
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    backgroundColor: "#c62828",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 10,
    marginBottom: 6,
  },
  completeAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 10,
    marginBottom: 6,
  },
  actionText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
});
