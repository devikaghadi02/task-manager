import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Detect if running inside Expo Go (vs a real development/standalone build).
// Expo Go (SDK 53+) blocks remote push token registration entirely, which
// throws a noisy error on import if those code paths get triggered. Local
// scheduled notifications still work fine in Expo Go — we just avoid
// calling any remote push token APIs.
const isExpoGo = Constants.appOwnership === "expo";

// This handler controls how notifications behave while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF" + ColorSpace.accent.replace("#", ""),
    });
  }

  if (!Device.isDevice) {
    console.log("Must use a physical device for notifications");
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Notification permission not granted");
    return false;
  }

  if (isExpoGo) {
    console.log(
      "Running in Expo Go — local notifications only, no push token needed",
    );
  }

  return true;
}

export async function scheduleTaskReminder(
  taskId: string,
  title: string,
  dueDate: Date,
) {
  // Cancel any existing notification for this task first
  await cancelTaskReminder(taskId);

  const trigger = dueDate;
  const now = new Date();

  // Don't schedule if due date is in the past
  if (trigger <= now) {
    return null;
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Task Due",
      body: title,
      data: { taskId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
    },
  });

  return notificationId;
}

export async function cancelTaskReminder(taskId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const match = scheduled.find((n) => n.content.data?.taskId === taskId);
  if (match) {
    await Notifications.cancelScheduledNotificationAsync(match.identifier);
  }
}
