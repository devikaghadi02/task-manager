import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import { useTheme } from "../lib/ThemeContext";

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  user_id: string;
  due_date: string | null;
  priority: string;
  category: string | null;
  task_order?: number;
};

type Props = {
  tasks: Task[];
  renderItem: (item: Task, index: number) => React.ReactNode;
  onReorder: (tasks: Task[]) => void;
};

export default function ReorderableTaskList({
  tasks,
  renderItem,
  onReorder,
}: Props) {
  const { colors } = useTheme();
  const [localTasks, setLocalTasks] = useState(tasks);

  const handleReorder = useCallback(
    (newOrder: Task[]) => {
      setLocalTasks(newOrder);
      onReorder(newOrder);
    },
    [onReorder],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {localTasks.map((task, index) => (
          <DraggableTaskItem
            key={task.id}
            task={task}
            index={index}
            tasks={localTasks}
            onReorder={handleReorder}
            renderItem={() => renderItem(task, index)}
          />
        ))}
      </View>
    </GestureHandlerRootView>
  );
}

type DraggableProps = {
  task: Task;
  index: number;
  tasks: Task[];
  onReorder: (tasks: Task[]) => void;
  renderItem: () => React.ReactNode;
};

function DraggableTaskItem({
  task,
  index,
  tasks,
  onReorder,
  renderItem,
}: DraggableProps) {
  const offsetY = useSharedValue(0);
  const isBeingDragged = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (isBeingDragged.value) {
        offsetY.value = e.translationY;

        // Calculate new index based on drag position
        const newIndex = Math.max(
          0,
          Math.min(tasks.length - 1, Math.round(index + e.translationY / 70)),
        );

        if (newIndex !== index && newIndex >= 0 && newIndex < tasks.length) {
          const newTasks = [...tasks];
          const [draggedTask] = newTasks.splice(index, 1);
          newTasks.splice(newIndex, 0, draggedTask);
          onReorder(newTasks);
        }
      }
    })
    .onStart(() => {
      isBeingDragged.value = true;
    })
    .onFinalize(() => {
      offsetY.value = withSpring(0);
      isBeingDragged.value = false;
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onStart(() => {
      isBeingDragged.value = true;
    });

  const composed = Gesture.Simultaneous(longPressGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetY.value }],
    opacity: isBeingDragged.value ? 0.8 : 1,
    zIndex: isBeingDragged.value ? 1000 : 0,
    elevation: isBeingDragged.value ? 10 : 0,
    shadowColor: isBeingDragged.value ? "#000" : "transparent",
    shadowOpacity: isBeingDragged.value ? 0.3 : 0,
    shadowRadius: isBeingDragged.value ? 8 : 0,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[animatedStyle, styles.taskWrapper]}>
        {renderItem()}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingVertical: 8,
  },
  taskWrapper: {
    marginHorizontal: 16,
    marginVertical: 3,
  },
});
