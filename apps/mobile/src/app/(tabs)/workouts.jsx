import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import {
  Plus,
  Trash2,
  Dumbbell,
  Clock3,
  Activity,
} from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

const newExercise = () => ({
  name: "",
  sets: "3",
  reps: "10",
  rest: "60",
  weight: "",
});

export default function Workouts() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialMode = useMemo(
    () => (params?.mode === "ai" ? "ai" : "manual"),
    [params?.mode]
  );

  const [mode, setMode] = useState(initialMode);
  const [workoutName, setWorkoutName] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState([newExercise()]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const BASE_URL =
    Platform.OS === "android"
      ? "http://10.0.2.2:4000"
      : "http://192.168.100.123:4000";

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const addExercise = () => setExercises((prev) => [...prev, newExercise()]);
  const removeExercise = (idx) =>
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  const updateExercise = (idx, key, value) =>
    setExercises((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, [key]: value } : ex))
    );

  const resetForm = () => {
    setWorkoutName("");
    setDescription("");
    setExercises([newExercise()]);
  };

  const submitWorkout = async () => {
    if (!workoutName.trim()) {
      Alert.alert("Greška", "Unesi naziv treninga");
      return;
    }
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("Nema tokena");

      const payload = {
        name: workoutName.trim(),
        description: description.trim(),
        exercises: exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest: ex.rest,
          weight: ex.weight,
        })),
      };

      const res = await fetch(`${BASE_URL}/workouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      resetForm();
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Create workout error:", err);
      Alert.alert("Greška", err.message || "Neuspešno kreiranje");
    } finally {
      setLoading(false);
    }
  };

  const submitAI = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert("Greška", "Unesi prompt za AI kreiranje");
      return;
    }
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("Nema tokena");

      const res = await fetch(`${BASE_URL}/workouts/ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setAiPrompt("");
      router.replace("/(tabs)");
    } catch (err) {
      console.error("AI workout error:", err);
      Alert.alert("Greška", err.message || "Neuspešno AI kreiranje");
    } finally {
      setLoading(false);
    }
  };

  const modeButton = (id, label) => {
    const active = mode === id;
    return (
      <TouchableOpacity
        onPress={() => setMode(id)}
        style={{
          flex: 1,
          backgroundColor: active ? "#0EA5E9" : "#0F1E32",
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: active ? "#22D3EE55" : "#22D3EE22",
        }}
      >
        <Text
          style={{
            color: active ? "#0A1628" : "#E5E7EB",
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={["#0B1629", "#0A1323", "#060C1A"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 12,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#E0F2FE",
                marginBottom: 4,
              }}
            >
              Kreiraj trening
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
              Manualno ili AI kreiranje programa.
            </Text>
          </View>

          <View style={{ paddingHorizontal: 20, marginBottom: 16, flexDirection: "row", gap: 10 }}>
            {modeButton("manual", "Manual")}
            {modeButton("ai", "AI Create")}
          </View>

          {mode === "manual" ? (
            <ManualForm
              workoutName={workoutName}
              description={description}
              exercises={exercises}
              setWorkoutName={setWorkoutName}
              setDescription={setDescription}
              addExercise={addExercise}
              removeExercise={removeExercise}
              updateExercise={updateExercise}
              resetForm={resetForm}
              submitWorkout={submitWorkout}
              loading={loading}
            />
          ) : (
            <AIForm
              aiPrompt={aiPrompt}
              setAiPrompt={setAiPrompt}
              submitAI={submitAI}
              loading={loading}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {loading ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#020712CC",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinearGradient
            colors={["#22D3EE44", "#8EF26444"]}
            style={{
              paddingVertical: 22,
              paddingHorizontal: 20,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#22D3EE55",
              width: "78%",
              maxWidth: 360,
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                backgroundColor: "#0A1628",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "#22D3EE55",
              }}
            >
              <Activity color="#22D3EE" size={26} />
            </View>
            <Text
              style={{
                color: "#E0F2FE",
                fontWeight: "800",
                fontSize: 16,
                textAlign: "center",
              }}
            >
              Generišemo AI trening...
            </Text>
            <Text
              style={{
                color: "#9CA3AF",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              Kreiramo plan u pozadini, samo trenutak.
            </Text>
          </LinearGradient>
        </View>
      ) : null}
    </LinearGradient>
  );
}

function ManualForm({
  workoutName,
  description,
  exercises,
  setWorkoutName,
  setDescription,
  addExercise,
  removeExercise,
  updateExercise,
  resetForm,
  submitWorkout,
  loading,
}) {
  return (
    <View style={{ paddingHorizontal: 20, gap: 16 }}>
      {/* Workout Name */}
      <View
        style={{
          backgroundColor: "#0F1E32",
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: "#22D3EE33",
        }}
      >
        <Text
          style={{
            color: "#22D3EE",
            fontWeight: "700",
            marginBottom: 8,
            fontSize: 14,
          }}
        >
          Workout Name
        </Text>
        <TextInput
          value={workoutName}
          onChangeText={setWorkoutName}
          placeholder="e.g., Upper Body Blast"
          placeholderTextColor="#6B7280"
          style={{
            backgroundColor: "#0A1628",
            borderRadius: 12,
            padding: 14,
            color: "#fff",
            borderWidth: 1,
            borderColor: "#22D3EE33",
            fontSize: 15,
          }}
        />
      </View>

      {/* Description */}
      <View
        style={{
          backgroundColor: "#0F1E32",
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: "#22D3EE33",
        }}
      >
        <Text
          style={{
            color: "#22D3EE",
            fontWeight: "700",
            marginBottom: 8,
            fontSize: 14,
          }}
        >
          Description
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="e.g., Chest, shoulders, and triceps"
          placeholderTextColor="#6B7280"
          multiline
          style={{
            backgroundColor: "#0A1628",
            borderRadius: 12,
            padding: 14,
            color: "#fff",
            borderWidth: 1,
            borderColor: "#22D3EE33",
            fontSize: 15,
            minHeight: 70,
            textAlignVertical: "top",
          }}
        />
      </View>

      {/* Exercises header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: "#22D3EE",
            fontWeight: "800",
            fontSize: 15,
          }}
        >
          Exercises
        </Text>
        <TouchableOpacity
          onPress={addExercise}
          style={{
            backgroundColor: "#0EA5E9",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus color="#0A1628" size={18} />
          <Text
            style={{
              color: "#0A1628",
              fontWeight: "700",
              fontSize: 14,
            }}
          >
            Add Exercise
          </Text>
        </TouchableOpacity>
      </View>

      {/* Exercise cards */}
      <View style={{ gap: 14 }}>
        {exercises.map((ex, idx) => (
          <View
            key={`ex-${idx}`}
            style={{
              backgroundColor: "#0D1A2E",
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: "#22D3EE22",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  color: "#E5E7EB",
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                Exercise {idx + 1}
              </Text>
              <TouchableOpacity
                onPress={() => removeExercise(idx)}
                disabled={exercises.length === 1}
                style={{
                  opacity: exercises.length === 1 ? 0.4 : 1,
                  padding: 6,
                }}
              >
                <Trash2 color="#EF4444" size={18} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={ex.name}
              onChangeText={(v) => updateExercise(idx, "name", v)}
              placeholder="Exercise name"
              placeholderTextColor="#6B7280"
              style={{
                backgroundColor: "#0A1628",
                borderRadius: 12,
                padding: 12,
                color: "#fff",
                borderWidth: 1,
                borderColor: "#22D3EE33",
                fontSize: 14,
                marginBottom: 12,
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <NumberInput
                label="Sets"
                value={ex.sets}
                onChangeText={(v) => updateExercise(idx, "sets", v)}
                icon={<Dumbbell color="#22D3EE" size={16} />}
              />
              <NumberInput
                label="Reps"
                value={ex.reps}
                onChangeText={(v) => updateExercise(idx, "reps", v)}
                icon={<Activity color="#A7F3D0" size={16} />}
              />
              <NumberInput
                label="Rest (s)"
                value={ex.rest}
                onChangeText={(v) => updateExercise(idx, "rest", v)}
                icon={<Clock3 color="#C4B5FD" size={16} />}
              />
            </View>

            <TextInput
              value={ex.weight}
              onChangeText={(v) => updateExercise(idx, "weight", v)}
              placeholder="Target Weight (kg) - Optional"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              style={{
                backgroundColor: "#0A1628",
                borderRadius: 12,
                padding: 12,
                color: "#fff",
                borderWidth: 1,
                borderColor: "#22D3EE33",
                fontSize: 14,
                flexDirection: "row",
                alignItems: "center",
              }}
            />
          </View>
        ))}
      </View>

      {/* Footer actions */}
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          marginTop: 10,
          marginBottom: 10,
        }}
      >
        <TouchableOpacity
          onPress={resetForm}
          style={{
            flex: 1,
            backgroundColor: "#0F1E32",
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#22D3EE33",
          }}
        >
          <Text style={{ color: "#E5E7EB", fontWeight: "700", fontSize: 15 }}>
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={submitWorkout}
          style={{ flex: 1, opacity: loading ? 0.6 : 1 }}
          activeOpacity={0.9}
          disabled={loading}
        >
          <LinearGradient
            colors={["#22D3EE", "#8EF264"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              borderWidth: 1,
              borderColor: "#22D3EE55",
            }}
          >
            <Plus color="#0A1628" size={18} />
            <Text style={{ color: "#0A1628", fontWeight: "800", fontSize: 15 }}>
              Create Workout
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AIForm({ aiPrompt, setAiPrompt, submitAI, loading }) {
  return (
    <View style={{ paddingHorizontal: 20, gap: 16 }}>
      <View
        style={{
          backgroundColor: "#0F1E32",
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: "#22D3EE33",
        }}
      >
        <Text
          style={{
            color: "#22D3EE",
            fontWeight: "700",
            marginBottom: 8,
            fontSize: 14,
          }}
        >
          AI Prompt
        </Text>
        <TextInput
          value={aiPrompt}
          onChangeText={setAiPrompt}
          placeholder="e.g., Push workout for shoulders and triceps, 30 min"
          placeholderTextColor="#6B7280"
          multiline
          style={{
            backgroundColor: "#0A1628",
            borderRadius: 12,
            padding: 14,
            color: "#fff",
            borderWidth: 1,
            borderColor: "#22D3EE33",
            fontSize: 15,
            minHeight: 100,
            textAlignVertical: "top",
          }}
        />
      </View>

      <TouchableOpacity
        onPress={submitAI}
        style={{ opacity: loading ? 0.6 : 1 }}
        disabled={loading}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={["#A855F7", "#E879F9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            borderWidth: 1,
            borderColor: "#D8B4FE55",
          }}
        >
          <Plus color="#0A1628" size={18} />
          <Text style={{ color: "#0A1628", fontWeight: "800", fontSize: 15 }}>
            Create AI Workout
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function NumberInput({ label, value, onChangeText, icon }) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: "#9CA3AF",
          fontSize: 12,
          marginBottom: 6,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#0A1628",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#22D3EE33",
          paddingHorizontal: 10,
        }}
      >
        {icon ? <View style={{ marginRight: 6 }}>{icon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#6B7280"
          style={{
            flex: 1,
            paddingVertical: 10,
            color: "#fff",
            fontSize: 14,
          }}
        />
      </View>
    </View>
  );
}
