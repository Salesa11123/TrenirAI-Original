import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Dumbbell, Plus, Clock, TrendingUp } from "lucide-react-native";

export default function Workouts() {
  const insets = useSafeAreaInsets();

  const workouts = [
    {
      id: 1,
      name: "Upper Body Strength",
      duration: "45 min",
      calories: 320,
      difficulty: "Intermediate",
    },
    {
      id: 2,
      name: "HIIT Cardio Blast",
      duration: "30 min",
      calories: 280,
      difficulty: "Advanced",
    },
    {
      id: 3,
      name: "Leg Day Power",
      duration: "50 min",
      calories: 400,
      difficulty: "Intermediate",
    },
    {
      id: 4,
      name: "Core & Abs",
      duration: "25 min",
      calories: 180,
      difficulty: "Beginner",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1628" }}>
      <StatusBar style="light" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: 20,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color: "#fff",
            marginBottom: 8,
          }}
        >
          Workouts
        </Text>
        <Text style={{ fontSize: 16, color: "#9CA3AF", marginBottom: 24 }}>
          Choose your training
        </Text>

        {/* Add New Workout Button */}
        <TouchableOpacity
          style={{
            backgroundColor: "#22D3EE",
            borderRadius: 16,
            padding: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 24,
          }}
        >
          <Plus color="#0A1628" size={24} />
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "#0A1628" }}>
            Create New Workout
          </Text>
        </TouchableOpacity>

        {/* Workout Templates */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: "bold",
            color: "#fff",
            marginBottom: 16,
          }}
        >
          Templates
        </Text>

        {workouts.map((workout) => (
          <TouchableOpacity
            key={workout.id}
            style={{
              backgroundColor: "#0F1E32",
              borderRadius: 16,
              padding: 20,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: "#22D3EE22",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "#22D3EE22",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Dumbbell color="#22D3EE" size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: "#fff",
                    marginBottom: 4,
                  }}
                >
                  {workout.name}
                </Text>
                <Text style={{ fontSize: 12, color: "#8EF264" }}>
                  {workout.difficulty}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 16 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Clock color="#9CA3AF" size={16} />
                <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
                  {workout.duration}
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <TrendingUp color="#9CA3AF" size={16} />
                <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
                  {workout.calories} cal
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
