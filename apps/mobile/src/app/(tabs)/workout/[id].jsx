import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Play,
  Check,
  Pause,
  Trophy,
  Flame,
  Clock,
  Target,
} from "lucide-react-native";

export default function WorkoutDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const restIntervalRef = useRef(null);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    fetchWorkout();
  }, [id]);

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

  const fetchWorkout = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workouts/${id}`);
      if (!res.ok) throw new Error("Failed to fetch workout");
      const data = await res.json();
      setWorkout(data);
      setIsStarted(!!data.started_at);
      if (data.started_at) {
        setStartTime(new Date(data.started_at));
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load workout");
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkout = async () => {
    try {
      const res = await fetch(`/api/workouts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!res.ok) throw new Error("Failed to start workout");
      setIsStarted(true);
      setStartTime(new Date());
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to start workout");
    }
  };

  const handleUpdateSet = async (setId, weight, reps) => {
    try {
      const res = await fetch(`/api/workouts/${id}/sets/${setId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight_kg: parseFloat(weight),
          reps_completed: parseInt(reps),
          completed: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to update set");
      await fetchWorkout();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update set");
    }
  };

  const handleCompleteSet = (setId) => {
    setRestTimer(90); // 1.5 minutes rest
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
      const duration = startTime
        ? Math.floor((new Date() - startTime) / 1000 / 60)
        : null;

      // Calculate estimated calories burned
      const totalSets = workout.exercises.reduce(
        (sum, ex) => sum + ex.sets.length,
        0,
      );
      const estimatedCalories = Math.floor(totalSets * 15 + duration * 5);

      const res = await fetch(`/api/workouts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          duration,
          calories_burned: estimatedCalories,
        }),
      });

      if (!res.ok) throw new Error("Failed to complete workout");

      const data = await res.json();

      Alert.alert(
        "Workout Complete! 🎉",
        `Duration: ${duration} min\nTotal Weight: ${data.total_kg_lifted?.toFixed(0)} kg\nCalories: ~${estimatedCalories} kcal`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to complete workout");
    }
  };

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
    <View style={{ flex: 1, backgroundColor: "#0A1628" }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 20,
          paddingBottom: 20,
          backgroundColor: "#0F1E32",
          borderBottomWidth: 1,
          borderBottomColor: "#22D3EE33",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="#22D3EE" size={28} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>
              {workout.name}
            </Text>
            <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 2 }}>
              {workout.difficulty} • {workout.exercises.length} exercises
            </Text>
          </View>
        </View>

        {isStarted && startTime && (
          <View
            style={{
              backgroundColor: "#22D3EE11",
              borderRadius: 12,
              padding: 12,
              flexDirection: "row",
              gap: 16,
            }}
          >
            <View style={{ flex: 1, alignItems: "center" }}>
              <Clock color="#22D3EE" size={20} />
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                Duration
              </Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
                {Math.floor((new Date() - startTime) / 1000 / 60)} min
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Rest Timer Modal */}
      {isResting && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#0A1628EE",
            zIndex: 1000,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 18, color: "#22D3EE", marginBottom: 16 }}>
              Rest Time
            </Text>
            <Text style={{ fontSize: 80, fontWeight: "bold", color: "#fff" }}>
              {Math.floor(restTimer / 60)}:
              {(restTimer % 60).toString().padStart(2, "0")}
            </Text>
            <TouchableOpacity onPress={skipRest} style={{ marginTop: 30 }}>
              <LinearGradient
                colors={["#22D3EE", "#BEF264"]}
                style={{
                  borderRadius: 12,
                  padding: 16,
                  paddingHorizontal: 40,
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#0A0F1E" }}
                >
                  Skip Rest
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Exercises List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={{ padding: 20 }}>
          {workout.exercises.map((exercise, exerciseIndex) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              isActive={isStarted}
              onUpdateSet={handleUpdateSet}
              onCompleteSet={handleCompleteSet}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom Action Button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 20,
          paddingBottom: insets.bottom + 20,
          backgroundColor: "#0A1628",
          borderTopWidth: 1,
          borderTopColor: "#22D3EE33",
        }}
      >
        {!isStarted ? (
          <TouchableOpacity onPress={handleStartWorkout}>
            <LinearGradient
              colors={["#22D3EE", "#BEF264"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 16,
                padding: 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Play color="#0A0F1E" size={24} fill="#0A0F1E" />
              <Text
                style={{ fontSize: 18, fontWeight: "bold", color: "#0A0F1E" }}
              >
                Start Workout
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleCompleteWorkout}>
            <LinearGradient
              colors={["#BEF264", "#22D3EE"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 16,
                padding: 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Trophy color="#0A0F1E" size={24} />
              <Text
                style={{ fontSize: 18, fontWeight: "bold", color: "#0A0F1E" }}
              >
                Complete Workout
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ExerciseCard({ exercise, isActive, onUpdateSet, onCompleteSet }) {
  return (
    <View
      style={{
        backgroundColor: "#0F1E32",
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#22D3EE33",
      }}
    >
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "600", color: "#fff" }}>
          {exercise.name}
        </Text>
        <Text style={{ fontSize: 14, color: "#22D3EE", marginTop: 4 }}>
          {exercise.target_muscle} • {exercise.sets_count} sets ×{" "}
          {exercise.reps_per_set} reps
        </Text>
        {exercise.notes && (
          <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
            {exercise.notes}
          </Text>
        )}
      </View>

      {/* Sets */}
      <View style={{ gap: 10 }}>
        {exercise.sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            targetReps={exercise.reps_per_set}
            isActive={isActive}
            onUpdate={onUpdateSet}
            onComplete={onCompleteSet}
          />
        ))}
      </View>
    </View>
  );
}

function SetRow({ set, targetReps, isActive, onUpdate, onComplete }) {
  const [weight, setWeight] = useState(set.weight_kg?.toString() || "");
  const [reps, setReps] = useState(set.reps_completed?.toString() || "");

  const handleComplete = () => {
    if (!weight || !reps) {
      Alert.alert("Error", "Please enter weight and reps");
      return;
    }
    onUpdate(set.id, weight, reps);
    onComplete(set.id);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: set.completed ? "#BEF26422" : "#0A1628",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: set.completed ? "#BEF264" : "#22D3EE33",
      }}
    >
      <Text
        style={{ fontSize: 16, fontWeight: "600", color: "#22D3EE", width: 60 }}
      >
        Set {set.set_number}
      </Text>

      <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
        <TextInput
          value={weight}
          onChangeText={setWeight}
          placeholder="kg"
          placeholderTextColor="#6B7280"
          keyboardType="decimal-pad"
          editable={isActive && !set.completed}
          style={{
            flex: 1,
            backgroundColor: set.completed ? "#0A162822" : "#0A1628",
            borderRadius: 8,
            padding: 10,
            fontSize: 14,
            color: "#fff",
            borderWidth: 1,
            borderColor: "#22D3EE33",
            textAlign: "center",
          }}
        />
        <TextInput
          value={reps}
          onChangeText={setReps}
          placeholder={`${targetReps}`}
          placeholderTextColor="#6B7280"
          keyboardType="number-pad"
          editable={isActive && !set.completed}
          style={{
            flex: 1,
            backgroundColor: set.completed ? "#0A162822" : "#0A1628",
            borderRadius: 8,
            padding: 10,
            fontSize: 14,
            color: "#fff",
            borderWidth: 1,
            borderColor: "#22D3EE33",
            textAlign: "center",
          }}
        />
      </View>

      {isActive && !set.completed && (
        <TouchableOpacity
          onPress={handleComplete}
          style={{
            backgroundColor: "#BEF264",
            borderRadius: 8,
            padding: 10,
          }}
        >
          <Check color="#0A0F1E" size={20} />
        </TouchableOpacity>
      )}

      {set.completed && (
        <View
          style={{
            backgroundColor: "#BEF26444",
            borderRadius: 8,
            padding: 10,
          }}
        >
          <Check color="#BEF264" size={20} />
        </View>
      )}
    </View>
  );
}
