import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import {
  Flame,
  Target,
  TrendingUp,
  Calendar,
  Dumbbell,
  Play,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import useUser from "@/utils/auth/useUser";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveWorkout();
  }, []);

  const fetchActiveWorkout = async () => {
    try {
      const res = await fetch("/api/workouts?status=active&limit=1");
      if (res.ok) {
        const data = await res.json();
        if (data.workouts && data.workouts.length > 0) {
          setActiveWorkout(data.workouts[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching active workout:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1628" }}>
      <StatusBar style="light" />

      {/* Header with gradient */}
      <LinearGradient
        colors={["#22D3EE", "#8EF264"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 20,
          paddingBottom: 30,
          paddingHorizontal: 20,
        }}
      >
        <Text
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color: "#0A1628",
            marginBottom: 4,
          }}
        >
          TrenirAI
        </Text>
        <Text style={{ fontSize: 16, color: "#0A1628", opacity: 0.8 }}>
          Your Fitness Journey
        </Text>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Cards */}
        <View style={{ paddingHorizontal: 20, marginTop: -15 }}>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
            {/* Active Days */}
            <View
              style={{
                flex: 1,
                backgroundColor: "#0F1E32",
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: "#22D3EE33",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#22D3EE22",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Calendar color="#22D3EE" size={20} />
              </View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: "#fff",
                  marginBottom: 4,
                }}
              >
                12
              </Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
                Active Days
              </Text>
            </View>

            {/* Calories Burned */}
            <View
              style={{
                flex: 1,
                backgroundColor: "#0F1E32",
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: "#8EF26433",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#8EF26422",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Flame color="#8EF264" size={20} />
              </View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: "#fff",
                  marginBottom: 4,
                }}
              >
                2.4k
              </Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF" }}>Calories</Text>
            </View>
          </View>

          {/* Active Workout Card */}
          {loading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#22D3EE" />
            </View>
          ) : activeWorkout ? (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: "#fff",
                  marginBottom: 16,
                }}
              >
                Today's Workout
              </Text>
              <LinearGradient
                colors={["#22D3EE22", "#8EF26422"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 20,
                  borderWidth: 2,
                  borderColor: "#22D3EE44",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      backgroundColor: "#22D3EE",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Dumbbell color="#0A1628" size={24} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "bold",
                        color: "#fff",
                        marginBottom: 4,
                      }}
                    >
                      {activeWorkout.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#9CA3AF" }}>
                      {activeWorkout.exercise_count || 0} exercises
                    </Text>
                  </View>
                </View>

                <View
                  style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#0A162822",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        marginBottom: 4,
                      }}
                    >
                      Difficulty
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#fff",
                        textTransform: "capitalize",
                      }}
                    >
                      {activeWorkout.difficulty || "Medium"}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#0A162822",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        marginBottom: 4,
                      }}
                    >
                      Total Sets
                    </Text>
                    <Text
                      style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}
                    >
                      {activeWorkout.total_sets || 0}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    router.push(`/(tabs)/workout/${activeWorkout.id}`)
                  }
                  style={{ marginTop: 8 }}
                >
                  <LinearGradient
                    colors={["#22D3EE", "#8EF264"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      borderRadius: 14,
                      padding: 18,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Play color="#0A1628" size={20} fill="#0A1628" />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: "#0A1628",
                      }}
                    >
                      Start Training
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: "#0F1E32",
                borderRadius: 20,
                padding: 30,
                alignItems: "center",
                marginBottom: 24,
                borderWidth: 1,
                borderColor: "#22D3EE33",
              }}
            >
              <Dumbbell
                color="#9CA3AF"
                size={40}
                style={{ marginBottom: 12 }}
              />
              <Text
                style={{ fontSize: 16, color: "#9CA3AF", textAlign: "center" }}
              >
                No active workout found
              </Text>
            </View>
          )}

          {/* Training Objectives Section */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#fff",
                marginBottom: 16,
              }}
            >
              Training Objectives
            </Text>

            {/* Weight Loss Goal */}
            <View
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
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Target color="#22D3EE" size={20} />
                  <Text
                    style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}
                  >
                    Weight Loss
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 14, color: "#22D3EE", fontWeight: "600" }}
                >
                  75%
                </Text>
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: "#0A1628",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: "75%",
                    height: "100%",
                    backgroundColor: "#22D3EE",
                    borderRadius: 4,
                  }}
                />
              </View>
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8 }}>
                Target: 80kg • Current: 85kg
              </Text>
            </View>

            {/* Distance Running Goal */}
            <View
              style={{
                backgroundColor: "#0F1E32",
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: "#8EF26422",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <TrendingUp color="#8EF264" size={20} />
                  <Text
                    style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}
                  >
                    Distance Running
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 14, color: "#8EF264", fontWeight: "600" }}
                >
                  60%
                </Text>
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: "#0A1628",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: "60%",
                    height: "100%",
                    backgroundColor: "#8EF264",
                    borderRadius: 4,
                  }}
                />
              </View>
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8 }}>
                Goal: 50km/week • Progress: 30km
              </Text>
            </View>
          </View>

          {/* Weekly Analytics */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#fff",
                marginBottom: 16,
              }}
            >
              Weekly Analytics
            </Text>
            <View
              style={{
                backgroundColor: "#0F1E32",
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: "#22D3EE22",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-around",
                  marginBottom: 16,
                }}
              >
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => {
                  const heights = [40, 60, 45, 70, 55, 30, 50];
                  return (
                    <View key={index} style={{ alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          width: 32,
                          height: 80,
                          backgroundColor: "#0A1628",
                          borderRadius: 8,
                          justifyContent: "flex-end",
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: "100%",
                            height: `${heights[index]}%`,
                            backgroundColor:
                              index === 4 ? "#22D3EE" : "#22D3EE66",
                            borderRadius: 8,
                          }}
                        />
                      </View>
                      <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {day}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text
                style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}
              >
                Workout Frequency (minutes)
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
