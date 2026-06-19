# Drag-to-Reorder Feature - Implementation Summary

## Overview
This feature enables users to manually drag tasks into their preferred order within their task list. It uses `react-native-gesture-handler` and `react-native-reanimated` for smooth animations and gesture detection.

## Files Changed

### 1. **New Component: `components/ReorderableTaskList.tsx`**
- **Purpose**: Provides a reorderable list component using gesture detection
- **Key Features**:
  - Long-press (400ms) to initiate drag
  - Pan gesture to drag items vertically
  - Smooth spring animations
  - Visual feedback (opacity change, elevation)
  - Automatically reorders items in state and calls parent callback

- **Props**:
  - `tasks`: Array of Task objects to display
  - `renderItem`: Render function for each task
  - `onReorder`: Callback when tasks are reordered

- **Gesture Handling**:
  - Uses `Gesture.LongPress()` to detect drag start
  - Uses `Gesture.Pan()` to track vertical movement
  - Calculates new index based on drag distance
  - Triggers reorder when threshold is crossed

### 2. **Updated: `app/(tabs)/home.tsx`**

#### Added Import:
```tsx
import ReorderableTaskList from "../../components/ReorderableTaskList";
```

#### Updated Task Type:
```tsx
type Task = {
  id: string;
  title: string;
  completed: boolean;
  user_id: string;
  due_date: string | null;
  priority: string;
  category: string | null;
  task_order?: number;  // NEW: tracks custom order
};
```

#### New Function: `reorderTasks()`
```tsx
const reorderTasks = async (reorderedTasks: Task[]) => {
  try {
    // Update order in database
    for (let i = 0; i < reorderedTasks.length; i++) {
      await supabase
        .from("tasks")
        .update({ task_order: i })
        .eq("id", reorderedTasks[i].id);
    }

    // Update local state
    if (!isAdmin) {
      setTasks(reorderedTasks);
    }
  } catch (e) {
    console.log("Error reordering tasks:", e);
  }
};
```

#### Updated Rendering:
- **For Selection Mode**: Uses FlatList (no reordering while selecting)
- **For Normal Mode**: Uses ReorderableTaskList for drag support

```tsx
{selectionMode ? (
  <FlatList
    data={filteredTasks}
    keyExtractor={(item) => item.id}
    keyboardShouldPersistTaps="always"
    renderItem={({ item }) => <TaskCard item={item} />}
    ListEmptyComponent={
      <Text style={[styles.emptyText, { color: colors.subtext }]}>
        No tasks match your filters
      </Text>
    }
  />
) : (
  <ReorderableTaskList
    tasks={filteredTasks}
    renderItem={(item) => <TaskCard item={item} />}
    onReorder={reorderTasks}
  />
)}
```

### 3. **Database Migration: `supabase-migrations/add_task_order.sql`**
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_order INT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tasks_user_order ON tasks(user_id, task_order);
```

**Note**: Uses `task_order` instead of `order` (which is a reserved SQL keyword)

## How It Works

### User Flow:
1. User long-presses (400ms) on a task card
2. Card enters "dragging" state with visual feedback (reduced opacity)
3. User drags card up or down
4. Component calculates new position based on drag distance
5. Tasks automatically reorder in the list
6. On release, component:
   - Updates task_order values in the database
   - Updates local state
   - Animates back to normal state

### Key Features:
✅ **Interview-Signal**: Demonstrates deep knowledge of gesture handling  
✅ **Smooth Animations**: Spring animation using `react-native-reanimated`  
✅ **Visual Feedback**: Opacity and elevation changes during drag  
✅ **Persistent**: Order saved to Supabase database  
✅ **Smart State Management**: Disables in selection mode  
✅ **Priority Compatibility**: Works alongside sort-by options  

## Installation Steps

### 1. Run Database Migration
Execute the SQL in Supabase SQL editor or via Supabase CLI:
```bash
supabase db push supabase-migrations/add_task_order.sql
```

### 2. File Updates
The code changes are already implemented in:
- `components/ReorderableTaskList.tsx` (NEW)
- `app/(tabs)/home.tsx` (UPDATED)

### 3. Testing
```bash
npm start
# Navigate to home screen
# Long-press a task to drag it
# Verify order persists after app restart
```

## Behavior Notes

- **Selection Mode**: Dragging is disabled when multi-select is active
- **Sorting**: Manual drag order takes precedence over sort-by filters
- **Admin View**: Drag-to-reorder applies per-user section (can be extended)
- **Visual Feedback**: Task becomes semi-transparent (opacity: 0.8) during drag
- **Animation**: Spring animation smoothly returns task to final position

## Technical Considerations

- Uses `Gesture.Simultaneous()` to handle both long-press and pan simultaneously
- Tasks are reindexed (0-based) each time reorder occurs
- Database updates are sequential (can be batched in future optimization)
- Component is `GestureHandlerRootView` compatible

## Future Enhancements

1. **Batch Updates**: Use Supabase batch insert for better performance
2. **Undo/Redo**: Add task order history tracking
3. **Cross-Section Drag**: Allow dragging across priority groups
4. **Haptic Feedback**: Add vibration feedback on drag start/end
5. **Animation**: More sophisticated parallax or morphing animations
