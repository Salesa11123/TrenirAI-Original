import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";

// ✅ BASE URL (EMULATOR vs FIZIČKI TELEFON)
const BASE_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:4000"       // Android emulator
    : "http://192.168.100.114:4000"; // Fizički telefon (tvoj IP)

// -----------------------------------------------------

export default function Signup() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ---------------- PASSWORD VALIDATION ----------------

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd))
      return "Password must contain an uppercase letter";
    if (!/[a-z]/.test(pwd))
      return "Password must contain a lowercase letter";
    if (!/[0-9]/.test(pwd))
      return "Password must contain a number";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd))
      return "Password must contain a special character";
    return null;
  };

  // ---------------- STEP HANDLER ----------------

  const handleNext = async () => {
    // STEP 1 — USERNAME
    if (step === 1) {
      if (!username.trim()) {
        Alert.alert("Error", "Please enter a username");
        return;
      }
      if (username.trim().length < 3) {
        Alert.alert("Error", "Username must be at least 3 characters");
        return;
      }
      setStep(2);
      return;
    }

    // STEP 2 — EMAIL
    if (step === 2) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim()) {
        Alert.alert("Error", "Please enter your email");
        return;
      }
      if (!emailRegex.test(email)) {
        Alert.alert("Error", "Please enter a valid email address");
        return;
      }
      setStep(3);
      return;
    }

    // STEP 3 — PASSWORD + SIGNUP
    if (step === 3) {
      if (!password || !confirmPassword) {
        Alert.alert("Error", "Please fill in all fields");
        return;
      }

      const pwdError = validatePassword(password);
      if (pwdError) {
        Alert.alert("Password Error", pwdError);
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return;
      }

      setLoading(true);

      try {
        console.log("📤 SIGNUP REQUEST:", email);

        const res = await fetch(`${BASE_URL}/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            name: username,
          }),
        });

        const data = await res.json();

        console.log("📥 SIGNUP RESPONSE:", data);

        if (!res.ok) {
          Alert.alert("Signup failed", data.error || "Unknown error");
          return;
        }

        Alert.alert(
          "Success 🎉",
          "Account created successfully! Please sign in.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/auth/login"),
            },
          ]
        );
      } catch (err) {
        console.error("❌ SIGNUP ERROR:", err);
        Alert.alert("Error", "Cannot reach server");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  // ---------------- UI ----------------

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1628" }}>
      <StatusBar style="light" />

      <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1, paddingHorizontal: 30, paddingTop: 80 }}>
          {/* HEADER */}
          <View style={{ alignItems: "center", marginBottom: 30 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold", color: "#22D3EE" }}>
              Create account
            </Text>
            <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 8 }}>
              Join TrenirAI
            </Text>
          </View>

          {/* FORM CARD */}
          <View
            style={{
              backgroundColor: "#0F1E32",
              borderRadius: 24,
              padding: 30,
              borderWidth: 1,
              borderColor: "#22D3EE33",
            }}
          >
            {step === 1 && (
              <>
                <Text style={{ color: "#22D3EE", marginBottom: 10 }}>
                  Username
                </Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="johndoe"
                  placeholderTextColor="#6B7280"
                  style={{
                    backgroundColor: "#0A1628",
                    borderRadius: 12,
                    padding: 18,
                    color: "#fff",
                  }}
                />
              </>
            )}

            {step === 2 && (
              <>
                <Text style={{ color: "#22D3EE", marginBottom: 10 }}>
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor="#6B7280"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    backgroundColor: "#0A1628",
                    borderRadius: 12,
                    padding: 18,
                    color: "#fff",
                  }}
                />
              </>
            )}

            {step === 3 && (
              <>
                <Text style={{ color: "#22D3EE", marginBottom: 10 }}>
                  Password
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  style={{
                    backgroundColor: "#0A1628",
                    borderRadius: 12,
                    padding: 18,
                    color: "#fff",
                    marginBottom: 12,
                  }}
                />

                <Text style={{ color: "#22D3EE", marginBottom: 10 }}>
                  Confirm Password
                </Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  style={{
                    backgroundColor: "#0A1628",
                    borderRadius: 12,
                    padding: 18,
                    color: "#fff",
                  }}
                />
              </>
            )}
          </View>

          {/* BUTTONS */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 30 }}>
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
              <Text style={{ color: "#0A1628", fontWeight: "600" }}>
                Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              disabled={loading}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={["#22D3EE", "#8EF264"]}
                style={{
                  borderRadius: 16,
                  padding: 18,
                  alignItems: "center",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#0A1628", fontWeight: "600" }}>
                  {step === 3 ? "Create Account" : "Next"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.replace("/auth/login")}
            style={{ marginTop: 24, alignItems: "center" }}
          >
            <Text style={{ color: "#9CA3AF" }}>
              Already have an account?{" "}
              <Text style={{ color: "#22D3EE" }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingAnimatedView>
    </View>
  );
}
