import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bell,
  Settings,
  Plus,
  Wand2,
  Dumbbell,
  Activity,
  Clock3,
  Play,
  Trophy,
  Edit3,
  Trash2,
} from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";
import useUser from "@/utils/auth/useUser";
import * as SecureStore from "expo-secure-store";

export default function Home() {
  const router = useRouter();
  const { user } = useUser();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);

  const username = useMemo(() => user?.name || "Alex", [user?.name]);
  const BASE_URL =
    Platform.OS === "android"
      ? "http://10.0.2.2:4000"
      : "http://192.168.100.123:4000";

  useEffect(() => {
    fetchWorkouts();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchWorkouts();
    }, [])
  );

  async function fetchWorkouts() {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("token");
      if (!token) {
        setWorkouts([]);
        return;
      }
      const res = await fetch(`${BASE_URL}/workouts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWorkouts(data.workouts || []);
    } catch (err) {
      console.error("Home fetch workouts error:", err);
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  }

  const accentForIndex = (idx) =>
    idx % 2 === 0 ? ["#0EA5E9", "#22D3EE"] : ["#8EF264", "#4ADE80"];

  return (
    <LinearGradient
      colors={["#0A1628", "#071020", "#050B18"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text
                style={{
                  color: "#9CA3AF",
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                Welcome back,
              </Text>
              <Text
                style={{
                  color: "#22D3EE",
                  fontSize: 22,
                  fontWeight: "700",
                }}
              >
                {username}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: "#0F1E32",
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#22D3EE33",
                }}
              >
                <Bell color="#8EF264" size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: "#0F1E32",
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#22D3EE33",
                }}
              >
                <Settings color="#22D3EE" size={18} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions */}
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <Text
              style={{
                color: "#fff",
                fontSize: 18,
                fontWeight: "700",
                marginBottom: 6,
              }}
            >
              Moji Treninzi
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 12 }}>
              {workouts.length} programa
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={{ flex: 1 }}
                onPress={() => router.push("/(tabs)/workouts?mode=manual")}
              >
                <LinearGradient
                  colors={["#0EA5E9", "#22D3EE"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 16,
                    paddingVertical: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <Plus color="#0A1628" size={18} />
                  <Text
                    style={{ color: "#0A1628", fontWeight: "700", fontSize: 15 }}
                  >
                    Kreiraj
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={{ flex: 1 }}
                onPress={() => router.push("/(tabs)/workouts?mode=ai")}
              >
                <LinearGradient
                  colors={["#A855F7", "#E879F9"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 16,
                    paddingVertical: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <Wand2 color="#0A1628" size={18} />
                  <Text
                    style={{ color: "#0A1628", fontWeight: "700", fontSize: 15 }}
                  >
                    AI Kreiraj
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Program cards */}
          <View style={{ paddingHorizontal: 20, gap: 18 }}>
            {loading ? (
              <Text style={{ color: "#9CA3AF" }}>Loading workouts...</Text>
            ) : workouts.length === 0 ? (
              <View
                style={{
                  padding: 18,
                  borderRadius: 14,
                  backgroundColor: "#0F1E32",
                  borderWidth: 1,
                  borderColor: "#22D3EE22",
                }}
              >
                <Text style={{ color: "#E5E7EB", fontWeight: "700" }}>
                  Još nema treninga
                </Text>
                <Text style={{ color: "#9CA3AF", marginTop: 4 }}>
                  Kreiraj novi ili probaj AI kreiranje.
                </Text>
              </View>
            ) : (
              workouts.map((card, idx) => {
                const totalSets = card.exercises?.reduce(
                  (sum, ex) => sum + (parseInt(ex.sets, 10) || 0),
                  0
                );
                const totalRest = card.exercises?.reduce(
                  (sum, ex) =>
                    sum +
                    (parseInt(ex.sets, 10) || 0) *
                      (parseInt(ex.rest_seconds, 10) || 60),
                  0
                );
                const estimatedMinutes = Math.max(
                  5,
                  Math.round((totalRest + totalSets * 40) / 60)
                );
                const isComplete = card.status === "complete";
                const statusLabel =
                  card.status === "complete"
                    ? "Completed"
                    : card.status === "in_progress"
                    ? "In Progress"
                    : "Ready";
                return (
                  <LinearGradient
                    key={card.id}
                    colors={["#0E172A", "#0B1323"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: 1.2,
                      borderColor: isComplete ? "#8EF26466" : "#0EA5E922",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text
                          style={{
                            color: "#E0F2FE",
                            fontSize: 18,
                            fontWeight: "700",
                            marginBottom: 4,
                          }}
                        >
                          {card.name}
                        </Text>
                        {card.description ? (
                          <Text style={{ color: "#9CA3AF", fontSize: 13 }}>
                            {card.description}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        {isComplete ? (
                          <View
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              backgroundColor: "#122918",
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: "#8EF26455",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Trophy color="#8EF264" size={16} />
                            <Text
                              style={{
                                color: "#8EF264",
                                fontWeight: "700",
                                fontSize: 12,
                              }}
                            >
                              Completed
                            </Text>
                          </View>
                        ) : (
                          <>
                            <View
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                backgroundColor: "#0F1E32",
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: "#22D3EE44",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Activity color="#22D3EE" size={14} />
                              <Text
                                style={{
                                  color: "#22D3EE",
                                  fontWeight: "700",
                                  fontSize: 12,
                                }}
                              >
                                {statusLabel}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={{
                                backgroundColor: "#102036",
                                padding: 8,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: "#22D3EE33",
                              }}
                            >
                              <Edit3 color="#22D3EE" size={18} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{
                                backgroundColor: "#240F1C",
                                padding: 8,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: "#EF444422",
                              }}
                            >
                              <Trash2 color="#EF4444" size={18} />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>

                    {/* Stats row */}
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 16,
                        marginVertical: 14,
                      }}
                    >
                      <View
                        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                      >
                        <Dumbbell color="#22D3EE" size={18} />
                        <Text style={{ color: "#9CA3AF", fontSize: 13 }}>
                          {(card.exercises || []).length} exercises
                        </Text>
                      </View>
                      <View
                        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                      >
                        <Activity color="#A7F3D0" size={18} />
                        <Text style={{ color: "#9CA3AF", fontSize: 13 }}>
                          {totalSets || 0} sets
                        </Text>
                      </View>
                      <View
                        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                      >
                        <Clock3 color="#C4B5FD" size={18} />
                        <Text style={{ color: "#9CA3AF", fontSize: 13 }}>
                          ~{estimatedMinutes} min
                        </Text>
                      </View>
                    </View>

                    {/* Exercises */}
                    <View
                      style={{
                        backgroundColor: "#0A1628",
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "#22D3EE22",
                        padding: 12,
                        gap: 10,
                      }}
                    >
                      {(card.exercises || []).map((ex, idx2) => (
                        <View
                          key={`${card.id}-${idx2}`}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: "#E5E7EB", fontSize: 14 }}>
                            {ex.name}
                          </Text>
                          <Text
                            style={{ color: "#22D3EE", fontSize: 14, fontWeight: "600" }}
                          >
                            {(ex.sets || 0) + " × " + (ex.reps || 0)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={{ marginTop: 14 }}
                      onPress={() =>
                        router.push(
                          isComplete
                            ? `/(tabs)/workout/${card.id}?summary=1`
                            : `/(tabs)/workout/${card.id}`,
                        )
                      }
                    >
                      <LinearGradient
                        colors={
                          isComplete ? ["#8EF264", "#22D3EE"] : accentForIndex(idx)
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          borderRadius: 14,
                          paddingVertical: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 8,
                          borderWidth: 1,
                          borderColor: "#22D3EE44",
                        }}
                      >
                        {isComplete ? (
                          <Trophy color="#0A1628" size={18} />
                        ) : (
                          <Play color="#0A1628" size={18} fill="#0A1628" />
                        )}
                        <Text
                          style={{
                            color: "#0A1628",
                            fontWeight: "800",
                            fontSize: 15,
                          }}
                        >
                          {isComplete ? "View Summary" : "Start Workout"}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </LinearGradient>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
