import { Tabs } from "expo-router";
import { Home, Dumbbell, Apple, User } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0F1E",
          borderTopWidth: 1,
          borderTopColor: "#1a2332",
          paddingTop: 8,
          height: 85,
        },
        tabBarActiveTintColor: "#22D3EE",
        tabBarInactiveTintColor: "#6B7280",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Workouts",
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: "Nutrition",
          tabBarIcon: ({ color, size }) => <Apple color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="workout/[id]"
        options={{
          href: null, // Hide from tab bar but keep accessible
        }}
      />
    </Tabs>
  );
}
