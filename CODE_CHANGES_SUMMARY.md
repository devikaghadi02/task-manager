# Drag-to-Reorder - Code Changes Summary

## Files Modified/Created

### ✅ NEW: `components/ReorderableTaskList.tsx`

Complete new component for drag-to-reorder functionalityc

### ✅ UPDATED: `app/(tabs)/home.tsx`

#### Change 1: Updated imports (lines 1-19)

```diff
+ import ReorderableTaskList from "../../components/ReorderableTaskList";
```

#### Change 2: Updated Task type (line 21-29)

```diff
type Task = {
  id: string;
  title: string;
  completed: boolean;
  user_id: string;
  due_date: string | null;
  priority: string;
  category: string | null;
+ task_order?: number;
};
```

#### Change 3: New reorderTasks function (after toggleComplete, ~line 286)

```tsx
const reorderTasks = async (reorderedTasks: Task[]) => {
  try {
    for (let i = 0; i < reorderedTasks.length; i++) {
      await supabase
        .from("tasks")
        .update({ task_order: i })
        .eq("id", reorderedTasks[i].id);
    }
    if (!isAdmin) {
      setTasks(reorderedTasks);
    }
  } catch (e) {
    console.log("Error reordering tasks:", e);
  }
};
```

#### Change 4: Updated list rendering (line ~866-888)

```diff
- <FlatList
-   data={filteredTasks}
-   keyExtractor={(item) => item.id}
-   keyboardShouldPersistTaps="always"
-   renderItem={({ item }) => <TaskCard item={item} />}
-   ListEmptyComponent={
-     <Text style={[styles.emptyText, { color: colors.subtext }]}>
-       No tasks match your filters
-     </Text>
-   }
- />

+ {selectionMode ? (
+   <FlatList
+     data={filteredTasks}
+     keyExtractor={(item) => item.id}
+     keyboardShouldPersistTaps="always"
+     renderItem={({ item }) => <TaskCard item={item} />}
+     ListEmptyComponent={
+       <Text style={[styles.emptyText, { color: colors.subtext }]}>
+         No tasks match your filters
+       </Text>
+     }
+   />
+ ) : (
+   <ReorderableTaskList
+     tasks={filteredTasks}
+     renderItem={(item) => <TaskCard item={item} />}
+     onReorder={reorderTasks}
+   />
+ )}
```

### ✅ NEW: `supabase-migrations/add_task_order.sql`

Database migration to add task_order column

---

## Key Implementation Details

### ReorderableTaskList Component Architecture

```
ReorderableTaskList (Root)
└── GestureHandlerRootView
    └── Animated.View (container)
        └── DraggableTaskItem (for each task)
            └── GestureDetector
                └── Animated.View (task wrapper)
                    └── renderItem() (TaskCard)
```

### Gesture Handling Strategy

1. **LongPress**: 400ms hold to activate drag
2. **Pan**: Simultaneous gesture to detect vertical movement
3. **Reordering Logic**:
   - Move distance in pixels: ~70px per item
   - Calculate: `newIndex = round(currentIndex + dragY / 70)`
   - Clamp between 0 and array length

### State Updates

1. Local state updates immediately for smooth UX
2. Database updates sequentially via Supabase
3. Selection mode disables drag (uses FlatList instead)

---

## Testing Checklist

- [ ] Long-press task for 400ms (should activate drag)
- [ ] Drag task up/down (should reorder in real-time)
- [ ] Release task (should snap to final position)
- [ ] Refresh app (order should persist)
- [ ] Multi-select mode (drag should be disabled)
- [ ] Filter/Sort (reorder should work with filters)
- [ ] Swipe to delete (should still work alongside drag)

---

## Performance Notes

- Component uses `useSharedValue` and `useAnimatedStyle` from Reanimated
- No layout recalculation during drag (GPU accelerated)
- Database updates are sequential (could batch for performance)
- Index: `idx_tasks_user_order` speeds up sorted queries

---

## Backward Compatibility

✅ Fully backward compatible

- `task_order` defaults to 0
- Existing tasks get order based on insertion order
- No breaking changes to data structure
- Migration is non-destructive (IF NOT EXISTS clauses)
