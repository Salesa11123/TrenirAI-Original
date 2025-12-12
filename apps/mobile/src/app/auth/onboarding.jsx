import { useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Sparkles, Ruler } from "lucide-react-native";
import useUser from "@/utils/auth/useUser";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";



export default function Onboarding() {
  const router = useRouter();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    gender: "",
    day: "",
    month: "",
    year: "",
    height: "",
    weight: "",
    activityLevel: "",
    mainGoal: "",
    trainingPerWeek: "",
  });
  const [bmi, setBmi] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (formData.height && formData.weight) {
      const heightM = parseFloat(formData.height) / 100;
      const weightKg = parseFloat(formData.weight);
      const calculatedBmi = weightKg / (heightM * heightM);
      setBmi(calculatedBmi.toFixed(1));
    }
  }, [formData.height, formData.weight]);

  const activityLevels = [
    {
      id: "sedentary",
      label: "Sedentary",
      emoji: "🛋️",
      subtitle: "Little or no exercise",
    },
    {
      id: "light",
      label: "Lightly Active",
      emoji: "🚶",
      subtitle: "Exercise 1-3 days/week",
    },
    {
      id: "moderate",
      label: "Moderately Active",
      emoji: "🏃",
      subtitle: "Exercise 3-5 days/week",
    },
    {
      id: "very_active",
      label: "Very Active",
      emoji: "💪",
      subtitle: "Exercise 6-7 days/week",
    },
    {
      id: "extra_active",
      label: "Extra Active",
      emoji: "🔥",
      subtitle: "Physical job + exercise",
    },
  ];

  const mainGoals = [
    {
      id: "weight_loss",
      label: "Weight Loss",
      emoji: "⚖️",
      subtitle: "Reduce body fat",
    },
    {
      id: "muscle_gain",
      label: "Muscle Gain",
      emoji: "💪",
      subtitle: "Build muscle mass",
    },
    {
      id: "maintenance",
      label: "Maintenance",
      emoji: "✨",
      subtitle: "Stay in shape",
    },
    {
      id: "endurance",
      label: "Endurance",
      emoji: "🏃",
      subtitle: "Improve stamina",
    },
  ];

  const trainingOptions = [
    { id: "1-2", label: "1-2 times", emoji: "🎯" },
    { id: "3-4", label: "3-4 times", emoji: "💪" },
    { id: "5-6", label: "5-6 times", emoji: "🔥" },
    { id: "7+", label: "7+ times", emoji: "⚡" },
  ];

  const validateDate = (day, month, year) => {
    const d = parseInt(day);
    const m = parseInt(month);
    const y = parseInt(year);

    if (!d || !m || !y) return "Please enter a complete date";
    if (d < 1 || d > 31) return "Day must be between 1 and 31";
    if (m < 1 || m > 12) return "Month must be between 1 and 12";

    const currentYear = new Date().getFullYear();
    if (y < currentYear - 100) return "You must be younger than 100 years old";
    if (y > currentYear) return "Birth year cannot be in the future";

    // Check if date is valid
    const date = new Date(y, m - 1, d);
    if (
      date.getDate() !== d ||
      date.getMonth() !== m - 1 ||
      date.getFullYear() !== y
    ) {
      return "Invalid date";
    }

    // Check if date is in the future
    const today = new Date();
    if (date > today) {
      return "Birth date cannot be in the future";
    }

    // Check age (must be at least 13)
    const age = currentYear - y;
    if (age < 13) return "You must be at least 13 years old";

    return null;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.gender) {
        Alert.alert("Error", "Please select your gender");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const dateError = validateDate(
        formData.day,
        formData.month,
        formData.year,
      );
      if (dateError) {
        Alert.alert("Error", dateError);
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!formData.height || !formData.weight) {
        Alert.alert("Error", "Please enter your height and weight");
        return;
      }
      if (
        parseFloat(formData.height) < 100 ||
        parseFloat(formData.height) > 250
      ) {
        Alert.alert("Error", "Height must be between 100 and 250 cm");
        return;
      }
      if (
        parseFloat(formData.weight) < 30 ||
        parseFloat(formData.weight) > 300
      ) {
        Alert.alert("Error", "Weight must be between 30 and 300 kg");
        return;
      }
      setStep(4);
    } else if (step === 4) {
      handleComplete();
    }
  };

 const handleComplete = async () => {
  console.log("🟡 STEP 4: SAVE CLICKED");

  if (
    !formData.activityLevel ||
    !formData.mainGoal ||
    !formData.trainingPerWeek
  ) {
    Alert.alert("Error", "Please select all options");
    return;
  }

  setLoading(true);

  try {
    const token = await SecureStore.getItemAsync("token");
    console.log("🔐 TOKEN:", token);

    if (!token) {
      Alert.alert("Error", "No auth token found");
      return;
    }

    const payload = {
      gender: formData.gender,
      age: new Date().getFullYear() - parseInt(formData.year),
      height: Number(formData.height),
      weight: Number(formData.weight),
      activityLevel: formData.activityLevel,
      fitnessGoal: formData.mainGoal,
      trainingPerWeek: formData.trainingPerWeek,
    };

    console.log("📤 PAYLOAD:", payload);

    const res = await fetch("http://192.168.0.10:4000/users/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("📡 RESPONSE STATUS:", res.status);

    const text = await res.text();
    console.log("📨 RESPONSE BODY:", text);

    if (!res.ok) {
      throw new Error(text || "Failed to save profile");
    }

    console.log("✅ PROFILE SAVED — REDIRECTING");
    router.replace("/(tabs)");

  } catch (err) {
    console.error("❌ ONBOARDING ERROR:", err);
    Alert.alert("Error", err.message);
  } finally {
    setLoading(false);
  }
};


  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1628" }}>
      <StatusBar style="light" />

      <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 30,
            paddingTop: 60,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: "center", marginBottom: 30 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Text
                style={{ fontSize: 24, fontWeight: "bold", color: "#22D3EE" }}
              >
                Let's Get Started
              </Text>
              <Sparkles color="#22D3EE" size={24} />
            </View>
            <Text
              style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center" }}
            >
              Create your personalized fitness profile
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginBottom: 40,
              justifyContent: "center",
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  width: i === step ? 40 : 12,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i <= step ? "#22D3EE" : "#ffffff33",
                }}
              />
            ))}
          </View>

          {step === 1 && (
            <View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: "#fff",
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                What's your gender?
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#9CA3AF",
                  marginBottom: 60,
                  textAlign: "center",
                }}
              >
                This helps us calculate your calorie needs
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  gap: 16,
                  justifyContent: "center",
                }}
              >
                <TouchableOpacity
                  onPress={() => setFormData({ ...formData, gender: "male" })}
                  style={{
                    width: 150,
                    height: 180,
                    backgroundColor:
                      formData.gender === "male" ? "#22D3EE22" : "#0F1E32",
                    borderRadius: 24,
                    borderWidth: 2,
                    borderColor:
                      formData.gender === "male" ? "#22D3EE" : "#22D3EE33",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                  }}
                >
                  <Text style={{ fontSize: 80 }}>👨</Text>
                  <Text
                    style={{ fontSize: 18, fontWeight: "600", color: "#fff" }}
                  >
                    Male
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFormData({ ...formData, gender: "female" })}
                  style={{
                    width: 150,
                    height: 180,
                    backgroundColor:
                      formData.gender === "female" ? "#22D3EE22" : "#0F1E32",
                    borderRadius: 24,
                    borderWidth: 2,
                    borderColor:
                      formData.gender === "female" ? "#22D3EE" : "#22D3EE33",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                  }}
                >
                  <Text style={{ fontSize: 80 }}>👩</Text>
                  <Text
                    style={{ fontSize: 18, fontWeight: "600", color: "#fff" }}
                  >
                    Female
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <View style={{ alignItems: "center", marginBottom: 40 }}>
                <Text style={{ fontSize: 40, marginBottom: 16 }}>🎂</Text>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "bold",
                    color: "#fff",
                    marginBottom: 8,
                  }}
                >
                  When were you born?
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#9CA3AF",
                    textAlign: "center",
                  }}
                >
                  Age helps us personalize your training
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: "#0F1E32",
                  borderRadius: 24,
                  padding: 30,
                  borderWidth: 1,
                  borderColor: "#22D3EE33",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#22D3EE",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  Select Your Date of Birth
                </Text>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        marginBottom: 8,
                      }}
                    >
                      Day
                    </Text>
                    <TextInput
                      value={formData.day}
                      onChangeText={(text) => {
                        if (text.length <= 2 && /^\d*$/.test(text)) {
                          setFormData({ ...formData, day: text });
                        }
                      }}
                      placeholder="DD"
                      placeholderTextColor="#6B7280"
                      keyboardType="number-pad"
                      maxLength={2}
                      style={{
                        backgroundColor: "#0A1628",
                        borderRadius: 12,
                        padding: 18,
                        fontSize: 18,
                        color: "#fff",
                        borderWidth: 1,
                        borderColor: "#22D3EE33",
                        textAlign: "center",
                      }}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        marginBottom: 8,
                      }}
                    >
                      Month
                    </Text>
                    <TextInput
                      value={formData.month}
                      onChangeText={(text) => {
                        if (text.length <= 2 && /^\d*$/.test(text)) {
                          setFormData({ ...formData, month: text });
                        }
                      }}
                      placeholder="MM"
                      placeholderTextColor="#6B7280"
                      keyboardType="number-pad"
                      maxLength={2}
                      style={{
                        backgroundColor: "#0A1628",
                        borderRadius: 12,
                        padding: 18,
                        fontSize: 18,
                        color: "#fff",
                        borderWidth: 1,
                        borderColor: "#22D3EE33",
                        textAlign: "center",
                      }}
                    />
                  </View>

                  <View style={{ flex: 1.2 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        marginBottom: 8,
                      }}
                    >
                      Year
                    </Text>
                    <TextInput
                      value={formData.year}
                      onChangeText={(text) => {
                        if (text.length <= 4 && /^\d*$/.test(text)) {
                          setFormData({ ...formData, year: text });
                        }
                      }}
                      placeholder="YYYY"
                      placeholderTextColor="#6B7280"
                      keyboardType="number-pad"
                      maxLength={4}
                      style={{
                        backgroundColor: "#0A1628",
                        borderRadius: 12,
                        padding: 18,
                        fontSize: 18,
                        color: "#fff",
                        borderWidth: 1,
                        borderColor: "#22D3EE33",
                        textAlign: "center",
                      }}
                    />
                  </View>
                </View>

                {formData.day && formData.month && formData.year && (
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#9CA3AF",
                      marginTop: 16,
                      textAlign: "center",
                    }}
                  >
                    {formData.day}/{formData.month}/{formData.year}
                  </Text>
                )}
              </View>
            </View>
          )}

          {step === 3 && (
            <View>
              <View style={{ alignItems: "center", marginBottom: 40 }}>
                <Ruler color="#22D3EE" size={40} style={{ marginBottom: 16 }} />
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "bold",
                    color: "#fff",
                    marginBottom: 8,
                  }}
                >
                  Your measurements
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#9CA3AF",
                    textAlign: "center",
                  }}
                >
                  Tell us about your current physical stats
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: "#0F1E32",
                  borderRadius: 24,
                  padding: 30,
                  borderWidth: 1,
                  borderColor: "#22D3EE33",
                  gap: 20,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#22D3EE",
                      marginBottom: 12,
                    }}
                  >
                    Height (cm)
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TextInput
                      value={formData.height}
                      onChangeText={(text) =>
                        setFormData({ ...formData, height: text })
                      }
                      placeholder="173"
                      placeholderTextColor="#6B7280"
                      keyboardType="decimal-pad"
                      style={{
                        flex: 1,
                        backgroundColor: "#0A1628",
                        borderRadius: 12,
                        padding: 18,
                        fontSize: 18,
                        color: "#fff",
                        borderWidth: 1,
                        borderColor: "#22D3EE33",
                      }}
                    />
                    <Text
                      style={{ fontSize: 16, color: "#9CA3AF", marginLeft: 12 }}
                    >
                      cm
                    </Text>
                  </View>
                </View>

                <View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#22D3EE",
                      marginBottom: 12,
                    }}
                  >
                    Weight (kg)
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TextInput
                      value={formData.weight}
                      onChangeText={(text) =>
                        setFormData({ ...formData, weight: text })
                      }
                      placeholder="75"
                      placeholderTextColor="#6B7280"
                      keyboardType="decimal-pad"
                      style={{
                        flex: 1,
                        backgroundColor: "#0A1628",
                        borderRadius: 12,
                        padding: 18,
                        fontSize: 18,
                        color: "#fff",
                        borderWidth: 1,
                        borderColor: "#22D3EE33",
                      }}
                    />
                    <Text
                      style={{ fontSize: 16, color: "#9CA3AF", marginLeft: 12 }}
                    >
                      kg
                    </Text>
                  </View>
                </View>

                {bmi > 0 && (
                  <View
                    style={{
                      backgroundColor: "#22D3EE11",
                      borderRadius: 16,
                      padding: 20,
                      alignItems: "center",
                      marginTop: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: "#9CA3AF",
                        marginBottom: 8,
                      }}
                    >
                      Your BMI
                    </Text>
                    <Text
                      style={{
                        fontSize: 36,
                        fontWeight: "bold",
                        color: "#8EF264",
                      }}
                    >
                      {bmi}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {step === 4 && (
            <View>
              <View style={{ alignItems: "center", marginBottom: 30 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>🎯</Text>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "bold",
                    color: "#fff",
                    marginBottom: 8,
                  }}
                >
                  Activity & Goals
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#9CA3AF",
                    textAlign: "center",
                  }}
                >
                  Let's understand your fitness routine
                </Text>
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#22D3EE",
                    marginBottom: 16,
                  }}
                >
                  Physical Activity Level
                </Text>
                {activityLevels.map((level) => (
                  <TouchableOpacity
                    key={level.id}
                    onPress={() =>
                      setFormData({ ...formData, activityLevel: level.id })
                    }
                    style={{
                      backgroundColor:
                        formData.activityLevel === level.id
                          ? "#22D3EE22"
                          : "#0F1E32",
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 10,
                      borderWidth: 2,
                      borderColor:
                        formData.activityLevel === level.id
                          ? "#22D3EE"
                          : "#22D3EE33",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{level.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {level.label}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#9CA3AF" }}>
                        {level.subtitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#22D3EE",
                    marginBottom: 16,
                  }}
                >
                  Training Per Week
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
                >
                  {trainingOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() =>
                        setFormData({ ...formData, trainingPerWeek: option.id })
                      }
                      style={{
                        width: "48%",
                        backgroundColor:
                          formData.trainingPerWeek === option.id
                            ? "#8EF26422"
                            : "#0F1E32",
                        borderRadius: 16,
                        padding: 20,
                        borderWidth: 2,
                        borderColor:
                          formData.trainingPerWeek === option.id
                            ? "#8EF264"
                            : "#22D3EE33",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text style={{ fontSize: 32 }}>{option.emoji}</Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: "#fff",
                          textAlign: "center",
                        }}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#22D3EE",
                    marginBottom: 16,
                  }}
                >
                  Your Main Goal
                </Text>
                {mainGoals.map((goal) => (
                  <TouchableOpacity
                    key={goal.id}
                    onPress={() =>
                      setFormData({ ...formData, mainGoal: goal.id })
                    }
                    style={{
                      backgroundColor:
                        formData.mainGoal === goal.id ? "#8EF26422" : "#0F1E32",
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 10,
                      borderWidth: 2,
                      borderColor:
                        formData.mainGoal === goal.id ? "#8EF264" : "#22D3EE33",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{goal.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {goal.label}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#9CA3AF" }}>
                        {goal.subtitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 12, marginTop: 40 }}>
            {step > 1 && (
              <TouchableOpacity
                onPress={handleBack}
                style={{
                  flex: 1,
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 18,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#0A1628" }}
                >
                  Back
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleNext}
              disabled={loading}
              style={{
                flex: step > 1 ? 1 : undefined,
                width: step === 1 ? "100%" : undefined,
              }}
            >
              <LinearGradient
                colors={["#22D3EE", "#8EF264"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 16,
                  padding: 18,
                  alignItems: "center",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#0A1628" }}
                >
                  {loading
                    ? "Saving..."
                    : step === 4
                      ? "Complete Setup"
                      : "Next"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingAnimatedView>
    </View>
  );
}
