import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaskedView from "@react-native-masked-view/masked-view";
import {
  ArrowLeft,
  Play,
  Check,
  Trophy,
  Clock,
  Dumbbell,
  CheckCircle2,
  TrendingUp,
  Share2,
} from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import * as Clipboard from "expo-clipboard";
import { toast } from "sonner-native";
import { MotiView } from "moti";

const formatTimer = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, seconds || 0);
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${Math.max(1, minutes)}m`;
};

const buildSessionFromWorkout = (
  workout,
  startTime = new Date(),
  currentExerciseIndex = 0,
) => {
  if (!workout?.exercises?.length) {
    return {
      workoutId: workout?.id || "",
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      sets: [],
      currentExerciseIndex,
    };
  }

  return {
    workoutId: workout.id,
    startTime: startTime ? new Date(startTime).toISOString() : undefined,
    currentExerciseIndex,
    sets: workout.exercises.flatMap((exercise) =>
      (exercise.sets || []).map((set, idx) => ({
        exerciseId: exercise.id,
        setNumber: set.set_number ?? set.setNumber ?? idx + 1,
        weight:
          Number(
            set.weight_kg ??
              set.target_weight ??
              exercise.target_weight_kg ??
              0,
          ) || 0,
        completed: !!set.completed,
        completedAt: set.completed_at || undefined,
        reps:
          Number(
            set.reps_completed ??
              set.reps ??
              set.target_reps ??
              exercise.reps_per_set ??
              exercise.reps ??
              0,
          ) || 0,
      })),
    ),
  };
};

const getTotalWeight = (session) => {
  if (!session?.sets?.length) return 0;
  return session.sets
    .filter((set) => set.completed)
    .reduce((sum, set) => sum + Number(set.weight || 0), 0);
};

const getTotalSets = (session) => {
  if (!session?.sets?.length) return 0;
  return session.sets.filter((set) => set.completed).length;
};

const getExerciseSummary = (exercise, session) => {
  const plannedSets = Array.isArray(exercise.sets)
    ? exercise.sets.length
    : Number(exercise.sets || 0);
  const repsPerSet =
    exercise.reps_per_set || exercise.reps || exercise.target_reps || 0;

  const setsForExercise =
    session?.sets?.filter((set) => set.exerciseId === exercise.id) || [];
  const completedSets = setsForExercise.filter((set) => set.completed).length;
  const totalWeight = setsForExercise
    .filter((set) => set.completed)
    .reduce((sum, set) => sum + Number(set.weight || 0), 0);
  const avgWeight = completedSets > 0 ? totalWeight / completedSets : 0;

  return {
    completedSets,
    plannedSets,
    repsPerSet,
    totalWeight,
    avgWeight,
  };
};

const deriveSessionMetrics = (workout, session, durationSeconds = 0) => {
  const exercises = workout?.exercises || [];
  const perExercise = exercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    ...getExerciseSummary(ex, session),
  }));
  const totalLiftedKg = perExercise.reduce(
    (sum, ex) => sum + ex.totalWeight,
    0,
  );
  const totalSets = perExercise.reduce((sum, ex) => sum + ex.completedSets, 0);

  return {
    durationSeconds,
    totalLiftedKg,
    totalSets,
    perExercise,
  };
};

const findNextExerciseIndex = (workout) => {
  if (!workout?.exercises?.length) return 0;
  const idx = workout.exercises.findIndex((ex) =>
    ex.sets.some((set) => !set.completed),
  );
  return idx === -1 ? 0 : idx;
};

const calculateMetrics = (workout, elapsedSeconds) => {
  if (!workout?.exercises) {
    return {
      durationSeconds: elapsedSeconds || 0,
      totalLiftedKg: 0,
      calories: 0,
      perExercise: [],
      totalSets: 0,
    };
  }

  const perExercise = workout.exercises.map((ex) => {
    const setsCount = ex.sets.length;
    const totalKg = ex.sets.reduce(
      (sum, set) => sum + Number(set.weight_kg ?? set.target_weight ?? 0),
      0,
    );

    return {
      id: ex.id,
      name: ex.name,
      totalKg,
      sets: setsCount,
      completedSets: ex.sets.filter((s) => s.completed).length,
      avgKg: setsCount > 0 ? totalKg / setsCount : 0,
      repsPerSet: ex.reps_per_set,
    };
  });

  const durationSeconds = Math.max(0, elapsedSeconds || 0);
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const totalLiftedKg = perExercise.reduce((sum, ex) => sum + ex.totalKg, 0);
  const totalSets = perExercise.reduce((sum, ex) => sum + ex.sets, 0);
  const calories = Math.max(
    25,
    Math.round(durationMinutes * 6 + totalLiftedKg * 0.015),
  );

  return {
    durationSeconds,
    totalLiftedKg,
    calories,
    perExercise,
    totalSets,
  };
};

const computeDurationSeconds = (workout, fallbackSeconds = 0) => {
  if (!workout) return Math.max(0, fallbackSeconds || 0);
  if (workout.duration_minutes != null) {
    return Math.max(0, Number(workout.duration_minutes) * 60);
  }
  if (workout.started_at && workout.completed_at) {
    const diff =
      new Date(workout.completed_at).getTime() -
      new Date(workout.started_at).getTime();
    return Math.max(0, Math.floor(diff / 1000));
  }
  return Math.max(0, fallbackSeconds || 0);
};

const normalizeWorkout = (raw) => {
  if (!raw) return null;
  return {
    ...raw,
    status: raw.status || raw.workout_status || "ready",
    exercises: (raw.exercises || []).map((ex, exIdx) => {
      const repsPerSet =
        ex.reps_per_set || ex.reps || ex.reps_target || ex.target_reps || 0;
      const restSeconds = ex.rest_seconds || ex.rest || 90;
      const targetWeight =
        ex.target_weight_kg ?? ex.weight ?? ex.estimated_weight ?? null;
      const sets = (ex.sets || []).map((set, i) => ({
        ...set,
        target_reps:
          set.target_reps ??
          repsPerSet ??
          ex.reps ??
          ex.reps_per_set ??
          0,
        set_number: set.set_number || i + 1,
      }));
      return {
        ...ex,
        reps_per_set: repsPerSet,
        rest_seconds: restSeconds,
        target_weight_kg: targetWeight,
        sets,
      };
    }),
  };
};

export default function WorkoutDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const workoutId = useMemo(() => {
    if (!params?.id) return null;
    return Array.isArray(params.id) ? params.id[0] : params.id;
  }, [params?.id]);
  const shouldOpenSummary = useMemo(() => {
    const raw = params?.summary;
    const val = Array.isArray(raw) ? raw[0] : raw;
    return val === "1" || val === "true";
  }, [params?.summary]);
  const insets = useSafeAreaInsets();

  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const restIntervalRef = useRef(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [savingSetId, setSavingSetId] = useState(null);
  const [summary, setSummary] = useState(null);
  const isCompleted = workout?.status === "complete";
  const isInProgress = workout?.status === "in_progress";
  const BASE_URL =
    Platform.OS === "android"
      ? "http://10.0.2.2:4000"
      : "http://192.168.100.123:4000";

  const authedFetch = async (path, options = {}) => {
    const token = await SecureStore.getItemAsync("token");
    if (!token) throw new Error("Nema tokena");
    return fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  };

  useEffect(() => {
    if (workoutId) {
      fetchWorkout(workoutId);
    }
  }, [workoutId]);

  useEffect(() => {
    if (isResting && restTimer > 0) {
      restIntervalRef.current = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            clearInterval(restIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(restIntervalRef.current);
    }
  }, [isResting, restTimer]);

  useEffect(() => {
    if (!isStarted || !startTime) return;
    const tick = () => {
      setElapsedSeconds(
        Math.max(
          0,
          Math.floor((Date.now() - new Date(startTime).getTime()) / 1000),
        ),
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isStarted, startTime]);

  useEffect(() => {
    if (isCompleted && shouldOpenSummary && workout) {
      setSummary((prev) => {
        if (prev) return prev;
        const sessionData = buildSessionFromWorkout(
          workout,
          workout.started_at || new Date(),
        );
        return {
          metrics: deriveSessionMetrics(
            workout,
            sessionData,
            computeDurationSeconds(workout, 0),
          ),
          session: sessionData,
          completedAt: workout.completed_at ? new Date(workout.completed_at) : new Date(),
        };
      });
    }
  }, [isCompleted, shouldOpenSummary, workout]);

  const fetchWorkout = async (idParam) => {
    try {
      setLoading(true);
      const res = await authedFetch(`/workouts/${idParam}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to fetch workout (${res.status}): ${text}`);
      }
      const data = await res.json();
      const normalized = normalizeWorkout(data);
      setWorkout(normalized);
      const hasStarted = normalized.status === "in_progress";
      const hasCompleted = normalized.status === "complete";
      setIsStarted(hasStarted);
      if (hasStarted) {
        const startedAt = normalized.started_at
          ? new Date(normalized.started_at)
          : new Date();
        setStartTime(startedAt);
        setElapsedSeconds(
          Math.max(
            0,
            Math.floor((Date.now() - startedAt.getTime()) / 1000),
          ),
        );
      } else {
        setStartTime(normalized.started_at ? new Date(normalized.started_at) : null);
        setElapsedSeconds(
          hasCompleted
            ? computeDurationSeconds(normalized, 0)
            : 0,
        );
      }
      setCurrentExerciseIndex(findNextExerciseIndex(normalized));
      if (hasCompleted) {
        const sessionData = buildSessionFromWorkout(
          normalized,
          normalized.started_at || new Date(),
          findNextExerciseIndex(normalized),
        );
        setSummary({
          metrics: deriveSessionMetrics(
            normalized,
            sessionData,
            computeDurationSeconds(normalized, 0),
          ),
          session: sessionData,
          completedAt: normalized.completed_at
            ? new Date(normalized.completed_at)
            : new Date(),
        });
      } else {
        setSummary(null);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load workout");
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkout = async () => {
    if (isCompleted) {
      Alert.alert("Info", "Workout already completed.");
      return;
    }
    try {
      if (!workoutId) throw new Error("Workout ID missing");
      const res = await authedFetch(`/workouts/${workoutId}`, {
        method: "PUT",
        body: JSON.stringify({ action: "start" }),
      });
      if (!res.ok) throw new Error("Failed to start workout");
      const data = await res.json();
      const normalized = normalizeWorkout(data);
      setWorkout(normalized);
      setIsStarted(true);
      const now = new Date();
      setStartTime(now);
      setElapsedSeconds(0);
      setSummary(null);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to start workout");
    }
  };

  const handleUpdateSet = async (
    setId,
    weight,
    reps,
    restSeconds,
    completedFlag = true,
  ) => {
    try {
      setSavingSetId(setId);
      if (!workoutId) throw new Error("Workout ID missing");
      const res = await authedFetch(
        `/workouts/${workoutId}/sets/${setId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            weight_kg: parseFloat(weight),
            reps_completed: parseInt(reps, 10),
            completed: completedFlag,
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to update set (${res.status}): ${text}`);
      }
      const data = await res.json();
      const normalized = normalizeWorkout(data);
      setWorkout(normalized);
      setCurrentExerciseIndex(findNextExerciseIndex(normalized));
      if (completedFlag && restSeconds && restSeconds > 0) {
        startRestCountdown(restSeconds);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update set");
    } finally {
      setSavingSetId(null);
    }
  };

  const startRestCountdown = (seconds) => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
    }
    setRestTimer(seconds);
    setIsResting(true);
  };

  const skipRest = () => {
    setIsResting(false);
    setRestTimer(0);
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
    }
  };

  const handleCompleteWorkout = async () => {
    try {
      if (!isStarted) {
        Alert.alert("Info", "Pokreni trening pre zavrsetka.");
        return;
      }
      if (!workoutId) throw new Error("Workout ID missing");
      const computedElapsed =
        elapsedSeconds && elapsedSeconds > 0
          ? elapsedSeconds
          : startTime
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(startTime).getTime()) / 1000),
            )
          : 0;
      const metrics = calculateMetrics(workout, computedElapsed);
      const durationMinutes = Math.max(
        1,
        Math.round(metrics.durationSeconds / 60),
      );
      const sessionData = buildSessionFromWorkout(
        workout,
        startTime || new Date(),
        currentExerciseIndex,
      );

      const res = await authedFetch(`/workouts/${workoutId}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "complete",
          duration: durationMinutes,
          calories_burned: metrics.calories,
          total_kg_lifted: metrics.totalLiftedKg,
        }),
      });
      if (!res.ok) throw new Error("Failed to complete workout");
      const data = await res.json();
      const normalized = normalizeWorkout(data);
      setWorkout(normalized);
      setIsStarted(false);
      setSummary({
        metrics: deriveSessionMetrics(
          normalized,
          sessionData,
          computeDurationSeconds(normalized, metrics.durationSeconds),
        ),
        session: sessionData,
        completedAt: new Date(),
      });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to complete workout");
    }
  };

  const handleNextExercise = () => {
    if (!workout?.exercises?.length) return;
    const nextIndex = Math.min(
      currentExerciseIndex + 1,
      workout.exercises.length - 1,
    );
    setCurrentExerciseIndex(nextIndex);
  };

  const activeExercise = useMemo(
    () => {
      if (!workout?.exercises) return null;
      return workout.exercises.map((ex, idx) => ({
        ...ex,
        isLast: idx === workout.exercises.length - 1,
      }))?.[currentExerciseIndex];
    },
    [workout, currentExerciseIndex],
  );

  const displayTimerSeconds = useMemo(() => {
    if (isInProgress) return elapsedSeconds;
    if (isCompleted) return computeDurationSeconds(workout, elapsedSeconds || 0);
    return 0;
  }, [isInProgress, isCompleted, elapsedSeconds, workout]);

  const allSetsCompleted =
    workout?.exercises?.every((ex) =>
      ex.sets.every((s) => s.completed),
    ) || false;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0A1628",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#22D3EE" />
      </View>
    );
  }

  if (!workout) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0A1628",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18 }}>Workout not found</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#0B1629", "#090F1E", "#050910"]}
      style={{ flex: 1 }}
    >
      <StatusBar style="light" />

      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#1C2A3F",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="#22D3EE" size={26} />
          </TouchableOpacity>
          <View style={{ alignItems: "center", flex: 1 }}>
            <Text
              style={{ color: "#E0F2FE", fontSize: 18, fontWeight: "700" }}
              numberOfLines={1}
            >
              {workout.name}
            </Text>
            <Text style={{ color: "#93C5FD", fontSize: 12, marginTop: 2 }}>
              Live Workout
            </Text>
          </View>
          <View
            style={{
              backgroundColor: "#0F2135",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#22D3EE44",
            }}
          >
            <Text style={{ color: "#22D3EE", fontWeight: "700" }}>
              {formatTimer(displayTimerSeconds)}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <View
            style={{
              height: 8,
              backgroundColor: "#0F1E32",
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#12345655",
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${((currentExerciseIndex + 1) / workout.exercises.length) * 100}%`,
                backgroundColor: "#8EF264",
                borderRadius: 999,
              }}
            />
          </View>
        </View>
      </View>

      {isResting && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            backgroundColor: "#02060DCC",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              backgroundColor: "#0E1B2C",
              padding: 24,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#22D3EE55",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#22D3EE", fontSize: 16, marginBottom: 12 }}>
              Rest time
            </Text>
            <Text
              style={{ color: "#fff", fontSize: 52, fontWeight: "800" }}
            >{`${Math.floor(restTimer / 60)}:${(restTimer % 60)
              .toString()
              .padStart(2, "0")}`}</Text>
            <TouchableOpacity onPress={skipRest} style={{ marginTop: 20 }}>
              <LinearGradient
                colors={["#22D3EE", "#8EF264"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingHorizontal: 26,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{ color: "#0A0F1E", fontWeight: "700", fontSize: 15 }}
                >
                  Skip Rest
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingVertical: 14, gap: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TouchableOpacity
              onPress={() =>
                setCurrentExerciseIndex((prev) => Math.max(0, prev - 1))
              }
              disabled={currentExerciseIndex === 0}
              style={{ opacity: currentExerciseIndex === 0 ? 0.4 : 1 }}
            >
              <Text style={{ color: "#22D3EE", fontSize: 22 }}>‹</Text>
            </TouchableOpacity>

            <View style={{ alignItems: "center" }}>
              <Text style={{ color: "#9CA3AF", fontSize: 13 }}>
                Exercise {currentExerciseIndex + 1} of{" "}
                {workout.exercises.length}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  marginTop: 8,
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {workout.exercises.map((_, idx) => (
                  <View
                    key={`dot-${idx}`}
                    style={{
                      width: idx === currentExerciseIndex ? 24 : 10,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor:
                        idx === currentExerciseIndex ? "#8EF264" : "#1E2C42",
                    }}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={() =>
                setCurrentExerciseIndex((prev) =>
                  Math.min(workout.exercises.length - 1, prev + 1),
                )
              }
              disabled={currentExerciseIndex === workout.exercises.length - 1}
              style={{
                opacity:
                  currentExerciseIndex === workout.exercises.length - 1
                    ? 0.4
                    : 1,
              }}
            >
              <Text style={{ color: "#22D3EE", fontSize: 22 }}>›</Text>
            </TouchableOpacity>
          </View>

          {activeExercise ? (
            <View style={{ gap: 14 }}>
              <View
                style={{
                  backgroundColor: "#0C1526",
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#12345644",
                }}
              >
                <Text
                  style={{ color: "#E0F2FE", fontSize: 18, fontWeight: "800" }}
                >
                  {activeExercise.name}
                </Text>
                <Text
                  style={{ color: "#93C5FD", marginTop: 6, fontSize: 13 }}
                >
                  {activeExercise.sets.length} sets × {activeExercise.reps_per_set} reps
                </Text>
                <Text style={{ color: "#9CA3AF", marginTop: 6, fontSize: 12 }}>
                  Target:{" "}
                  {activeExercise.target_weight_kg
                    ? `${activeExercise.target_weight_kg} kg`
                    : "—"}
                </Text>
                <View
                  style={{
                    marginTop: 10,
                    alignSelf: "flex-start",
                    backgroundColor: "#0D2238",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#22D3EE33",
                  }}
                >
                  <Text
                    style={{
                      color: "#22D3EE",
                      fontWeight: "800",
                      fontSize: 12,
                    }}
                  >
                    {(activeExercise.rest_seconds || 0) || 0}s rest
                  </Text>
                </View>
              </View>

              <ExerciseCard
                exercise={activeExercise}
                isActive={isInProgress}
                onUpdateSet={handleUpdateSet}
                savingSetId={savingSetId}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 18,
          paddingTop: 8,
          paddingBottom: insets.bottom + 16,
          backgroundColor: "#050910EE",
          borderTopWidth: 1,
          borderTopColor: "#122136",
        }}
      >
        {isCompleted ? (
          <TouchableOpacity
            onPress={() =>
              setSummary((prev) =>
                prev ||
                (() => {
                  const sessionData = buildSessionFromWorkout(
                    workout,
                    workout?.started_at,
                  );
                  return {
                    metrics: deriveSessionMetrics(
                      workout,
                      sessionData,
                      computeDurationSeconds(workout, 0),
                    ),
                    session: sessionData,
                    completedAt: workout?.completed_at
                      ? new Date(workout.completed_at)
                      : new Date(),
                  };
                })(),
              )
            }
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#22D3EE", "#BEF264"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 10,
              }}
            >
              <Trophy color="#0A0F1E" size={22} />
              <Text
                style={{ color: "#0A0F1E", fontWeight: "800", fontSize: 16 }}
              >
                View Summary
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : !isStarted ? (
          <TouchableOpacity onPress={handleStartWorkout} activeOpacity={0.9}>
            <LinearGradient
              colors={["#22D3EE", "#8EF264"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 10,
              }}
            >
              <Play color="#0A0F1E" size={22} fill="#0A0F1E" />
              <Text
                style={{ color: "#0A0F1E", fontWeight: "800", fontSize: 16 }}
              >
                Start Training
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: "row", gap: 12 }}>
            {currentExerciseIndex < workout.exercises.length - 1 ? (
              <TouchableOpacity
                onPress={handleNextExercise}
                style={{ flex: 1 }}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#22D3EE", "#8EF264"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#22D3EE44",
                  }}
                >
                  <Text
                    style={{
                      color: "#0A0F1E",
                      fontWeight: "800",
                      fontSize: 15,
                    }}
                  >
                    Next Exercise
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            {currentExerciseIndex === workout.exercises.length - 1 &&
            allSetsCompleted ? (
              <TouchableOpacity
                onPress={handleCompleteWorkout}
                style={{ flex: 1 }}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#8EF264", "#22D3EE"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#22D3EE44",
                  }}
                >
                  <Trophy color="#0A0F1E" size={22} />
                  <Text
                    style={{
                      color: "#0A0F1E",
                      fontWeight: "800",
                      fontSize: 15,
                      marginTop: 4,
                    }}
                  >
                    Finish Workout
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>

      {summary ? (
        <WorkoutSummaryScreen
          workout={workout}
          summary={summary}
          onClose={() => router.back()}
          onStay={() => setSummary(null)}
        />
      ) : null}
    </LinearGradient>
  );
}

function ExerciseCard({ exercise, isActive, onUpdateSet, savingSetId }) {
  const restSeconds = Number(exercise.rest_seconds || exercise.rest || 90);
  const isLast = exercise.isLast;
  return (
    <View
      style={{
        backgroundColor: "#0C1526",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "#12345644",
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <View>
          <Text style={{ color: "#E0F2FE", fontSize: 18, fontWeight: "800" }}>
            {exercise.name}
          </Text>
          <Text style={{ color: "#93C5FD", marginTop: 4, fontSize: 13 }}>
            {exercise.sets.length} sets × {exercise.reps_per_set} reps
          </Text>
          {exercise.target_weight_kg ? (
            <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
              Target: {exercise.target_weight_kg} kg
            </Text>
          ) : null}
        </View>
        <View
          style={{
            backgroundColor: "#0D2238",
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#22D3EE33",
          }}
        >
          <Text style={{ color: "#22D3EE", fontWeight: "800", fontSize: 12 }}>
            {restSeconds}s rest
          </Text>
        </View>
      </View>

      {exercise.notes ? (
        <Text
          style={{
            color: "#9CA3AF",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {exercise.notes}
        </Text>
      ) : null}

      <View style={{ gap: 12 }}>
        {exercise.sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            targetReps={exercise.reps_per_set}
            restSeconds={restSeconds}
            isActive={isActive}
            onUpdate={onUpdateSet}
            savingSetId={savingSetId}
          />
        ))}
      </View>
    </View>
  );
}

function SetRow({
  set,
  targetReps,
  restSeconds,
  isActive,
  onUpdate,
  savingSetId,
}) {
  const initialReps =
    set.reps_completed != null
      ? set.reps_completed.toString()
      : targetReps != null
      ? targetReps.toString()
      : "";
  const [weight, setWeight] = useState(
    set.weight_kg != null ? set.weight_kg.toString() : "",
  );
  const [reps, setReps] = useState(initialReps);

  const sanitizeInt = (value) => value.replace(/[^0-9]/g, "");

  useEffect(() => {
    setWeight(set.weight_kg != null ? set.weight_kg.toString() : "");
  }, [set.id, set.weight_kg]);

  useEffect(() => {
    setReps(
      set.reps_completed != null
        ? set.reps_completed.toString()
        : targetReps != null
        ? targetReps.toString()
        : "",
    );
  }, [set.id, set.reps_completed, targetReps]);

  const handleComplete = (completedFlag = true) => {
    if (completedFlag) {
      if (!weight || !reps) {
        Alert.alert(
          "Info",
          "Unesi tezinu i ponavljanja pre nego sto zavrsis set.",
        );
        return;
      }
    }
    onUpdate(set.id, weight || "0", reps || "0", restSeconds, completedFlag);
  };

  const disabled = !isActive || savingSetId === set.id;

  return (
    <View
      style={{
        backgroundColor: set.completed ? "#0F2A1E" : "#0B1629",
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: set.completed ? "#8EF264" : "#1E2C42",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: "#11243A",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "#22D3EE44",
          }}
        >
          <Text style={{ color: "#22D3EE", fontWeight: "700" }}>
            {set.set_number}
          </Text>
        </View>
        {set.completed ? (
          <View
            style={{
              backgroundColor: "#102820",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#8EF264",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Check color="#8EF264" size={16} />
            <Text style={{ color: "#8EF264", fontWeight: "700" }}>Done</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 6 }}>
            Reps
          </Text>
          <TextInput
            value={reps}
            onChangeText={setReps}
            editable={!disabled}
            keyboardType="number-pad"
            placeholder={`${targetReps || 0}`}
            placeholderTextColor="#6B7280"
            style={{
              backgroundColor: set.completed ? "#13222F" : "#0F1E32",
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              color: "#fff",
              borderWidth: 1,
              borderColor: "#1E2C42",
              textAlign: "center",
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 6 }}>
            Weight (kg)
          </Text>
          <TextInput
            value={weight}
            onChangeText={(val) => setWeight(sanitizeInt(val))}
            editable={!disabled}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#6B7280"
            style={{
              backgroundColor: set.completed ? "#13222F" : "#0F1E32",
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              color: "#fff",
              borderWidth: 1,
              borderColor: "#1E2C42",
              textAlign: "center",
            }}
          />
        </View>
        {set.completed ? (
          <TouchableOpacity
            onPress={() => handleComplete(false)}
            disabled={disabled}
            style={{ justifyContent: "flex-end" }}
          >
            <View
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 10,
                backgroundColor: "#1E2C42",
                borderWidth: 1,
                borderColor: "#2F4058",
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <Text
                style={{ color: "#E0F2FE", fontWeight: "800", fontSize: 14 }}
              >
                {savingSetId === set.id ? "Saving..." : "Undo"}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => handleComplete(true)}
            disabled={disabled}
            style={{ justifyContent: "flex-end" }}
          >
            <LinearGradient
              colors={["#22D3EE", "#8EF264"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 10,
                opacity: disabled ? 0.5 : 1,
                borderWidth: 1,
                borderColor: "#22D3EE55",
              }}
            >
              <Text
                style={{ color: "#0A0F1E", fontWeight: "800", fontSize: 14 }}
              >
                {savingSetId === set.id ? "Saving..." : "Done"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}


function WorkoutSummaryScreen({ workout, summary, onClose, onStay }) {
  const insets = useSafeAreaInsets();
  const session = useMemo(
    () => summary?.session || buildSessionFromWorkout(workout),
    [summary?.session, workout],
  );

  const metrics = summary?.metrics || {
    durationSeconds: 0,
    totalLiftedKg: getTotalWeight(session),
    totalSets: getTotalSets(session),
  };

  const derived = useMemo(
    () =>
      deriveSessionMetrics(
        workout,
        session,
        metrics.durationSeconds || 0,
      ),
    [workout, session, metrics.durationSeconds],
  );

  const durationText = formatDuration(
    derived.durationSeconds || metrics.durationSeconds || 0,
  );
  const totalSets = derived.totalSets || 0;
  const totalWeight = Math.round(derived.totalLiftedKg || 0);
  const exercises = workout?.exercises || [];

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#020712E6",
      }}
    >
      <StatusBar style="light" />
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=2000&q=85",
        }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          opacity: 0.25,
        }}
        resizeMode="cover"
        blurRadius={2}
      />
      <LinearGradient
        colors={[
          "rgba(10,22,40,0.7)",
          "rgba(7,16,32,0.64)",
          "rgba(5,11,20,0.6)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 40,
            paddingHorizontal: 20,
            gap: 18,
          }}
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            from={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 14, delay: 0 }}
            style={{
              alignItems: "center",
              gap: 12,
            }}
          >
            <LinearGradient
              colors={["#9AE6B4", "#22C55E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 90,
                height: 90,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "#BEF26433",
                shadowColor: "#BEF264",
                shadowOpacity: 0.4,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  backgroundColor: "#0A1628",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trophy color="#BEF264" size={36} />
              </View>
            </LinearGradient>

            <GradientText
              text="Workout Complete!"
              style={{ fontSize: 24, fontWeight: "800", letterSpacing: 0.5 }}
              delay={300}
            />
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 400, delay: 400 }}
            >
              <Text
                style={{
                  color: "#E5E7EB",
                  fontSize: 16,
                  textAlign: "center",
                }}
              >
                Great job, you crushed it! ??
              </Text>
            </MotiView>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 450, delay: 500 }}
            style={{ flexDirection: "row", gap: 12 }}
          >
            <StatCard
              label="Duration"
              value={durationText}
              icon={<Clock color="#22D3EE" size={18} />}
              colors={["#0D2338", "#0F1E32"]}
            />
            <StatCard
              label="Sets"
              value={`${totalSets || 0}`}
              icon={<Dumbbell color="#BEF264" size={18} />}
              colors={["#0E2A28", "#0F1E32"]}
            />
            <StatCard
              label="Total kg"
              value={`${totalWeight} kg`}
              icon={<TrendingUp color="#C084FC" size={18} />}
              colors={["#1A1334", "#0F1E32"]}
            />
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 450, delay: 600 }}
            style={{
              backgroundColor: "#0F1E32",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(34,211,238,0.18)",
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <CheckCircle2 color="#BEF264" size={20} />
              <Text style={{ color: "#E5E7EB", fontSize: 16, fontWeight: "700" }}>
                {workout?.name || "Workout"}
              </Text>
            </View>
            {workout?.description ? (
              <Text style={{ color: "#9CA3AF", fontSize: 13, lineHeight: 18 }}>
                {workout.description}
              </Text>
            ) : null}
            <Text style={{ color: "#C7D2FE", fontSize: 13, fontWeight: "600" }}>
              {exercises.length} exercises completed
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 450, delay: 700 }}
            style={{ gap: 12 }}
          >
            <Text
              style={{
                color: "#E5E7EB",
                fontSize: 16,
                fontWeight: "800",
              }}
            >
              Exercise Breakdown
            </Text>
            <View style={{ gap: 10 }}>
              {exercises.map((exercise, idx) => (
                <MotiView
                  key={exercise.id || `ex-${idx}`}
                  from={{ opacity: 0, translateY: 12 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{
                    type: "timing",
                    duration: 400,
                    delay: 700 + idx * 100,
                  }}
                >
                  <ExerciseBreakdownRow
                    exercise={exercise}
                    session={session}
                  />
                </MotiView>
              ))}
            </View>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 400, delay: 800 }}
            style={{ marginTop: 10, marginBottom: 12 }}
          >
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.9}
              style={{ borderRadius: 14, overflow: "hidden" }}
            >
              <LinearGradient
                colors={["#22D3EE", "#BEF264"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <CheckCircle2 color="#0A1628" size={18} />
                <Text
                  style={{
                    color: "#0A1628",
                    fontWeight: "800",
                  }}
                >
                  Back to Dashboard
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </MotiView>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

function ExerciseBreakdownRow({ exercise, session }) {
  const summary = getExerciseSummary(exercise, session);

  return (
    <View
      style={{
        backgroundColor: "#0F1E32",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: "rgba(34,211,238,0.18)",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#E5E7EB", fontWeight: "700", fontSize: 14 }}>
          {exercise.name}
        </Text>
        <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
          {summary.completedSets}/{summary.plannedSets} sets x{" "}
          {summary.repsPerSet || "-"} reps
        </Text>
        <Text style={{ color: "#C7D2FE", fontSize: 12, marginTop: 4 }}>
          Total: {Math.round(summary.totalWeight)} kg | Avg:{" "}
          {Math.round(summary.avgWeight)} kg
        </Text>
      </View>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: "rgba(190,242,100,0.12)",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(190,242,100,0.35)",
        }}
      >
        <CheckCircle2 color="#BEF264" size={20} />
      </View>
    </View>
  );
}

function StatCard({ label, value, icon, colors }) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flex: 1,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: "rgba(34,211,238,0.2)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon}
        <Text style={{ color: "#9CA3AF", fontSize: 12, fontWeight: "600" }}>
          {label}
        </Text>
      </View>
      <Text
        style={{
          color: "#E0F2FE",
          fontWeight: "800",
          fontSize: 16,
          marginTop: 8,
        }}
      >
        {value}
      </Text>
    </LinearGradient>
  );
}

function GradientText({ text, style, delay = 0 }) {
  return (
    <MaskedView
      maskElement={
        <Text style={[style, { color: "#fff", textAlign: "center" }]}>
          {text}
        </Text>
      }
    >
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay }}
      >
        <LinearGradient
          colors={["#22D3EE", "#BEF264"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={[style, { opacity: 0 }]}>{text}</Text>
        </LinearGradient>
      </MotiView>
    </MaskedView>
  );
}

function RadialGlow({ size = 240, colors, top, left, bottom, right, reverse }) {
  return (
    <MotiView
      from={{ opacity: 0.5, scale: 0.9 }}
      animate={{ opacity: 0.8, scale: 1.05 }}
      transition={{
        type: "timing",
        duration: 9000,
        loop: true,
        delay: reverse ? 1000 : 0,
      }}
      style={{
        position: "absolute",
        top,
        left,
        bottom,
        right,
      }}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: 0.6,
        }}
      />
    </MotiView>
  );
}
