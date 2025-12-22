import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { LogIn } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { useAuth } from "@/utils/auth/useAuth";

export default function Login() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Automatsko detektovanje emulatora vs. telefona
  const BASE_URL =
    Platform.OS === "android"
      ? "http://10.0.2.2:4000" // Android emulator
      : "http://192.168.100.123:4000"; // Fizički telefon

  const API_URL = `${BASE_URL}/login`;

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    console.log("🔥 LOGIN BUTTON PRESSED");
    console.log("🚀 SENDING REQUEST TO:", API_URL);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const data = await res.json().catch(() => {
        console.log("⚠️ Server returned NO JSON!");
        return { error: "Invalid server response" };
      });

      console.log("📩 LOGIN RESPONSE:", data);

      if (!res.ok) {
        Alert.alert("Login failed", data.error || "Unknown server error");
        setLoading(false);
        return;
      }

      // Sačuvaj token i podigni auth state
      if (data.token) {
        setAuth({ jwt: data.token }); // isAuthenticated će postati true
        await SecureStore.setItemAsync("token", data.token); // legacy čitanje
      } else {
        console.log("⚠️ No token received from server");
      }

      console.log("✅ LOGIN SUCCESS!");
      router.replace("/");
    } catch (err) {
      console.log("❌ LOGIN ERROR:", err);
      Alert.alert("Error", "Unable to reach server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1628" }}>
      <StatusBar style="light" />

      <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1, paddingHorizontal: 30, justifyContent: "center" }}>
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 50 }}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "bold",
                color: "#22D3EE",
                marginBottom: 12,
              }}
            >
              Welcome Back
            </Text>
            <Text style={{ fontSize: 16, color: "#9CA3AF", textAlign: "center" }}>
              Sign in to continue your fitness journey
            </Text>
          </View>

          {/* Form Card */}
          <View
            style={{
              backgroundColor: "#0F1E32",
              borderRadius: 24,
              padding: 30,
              borderWidth: 1,
              borderColor: "#22D3EE33",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 30 }}>
              <LinearGradient
                colors={["#22D3EE", "#8EF264"]}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LogIn color="#0A1628" size={50} />
              </LinearGradient>
            </View>

            {/* Email */}
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#22D3EE",
                marginBottom: 12,
              }}
            >
              Email
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#9CA3AF"
              editable={!loading}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: "#0A1628",
                borderRadius: 16,
                padding: 20,
                fontSize: 16,
                color: "#fff",
                borderWidth: 2,
                borderColor: "#22D3EE33",
                marginBottom: 20,
              }}
            />

            {/* Password */}
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#22D3EE",
                marginBottom: 12,
              }}
            >
              Password
            </Text>

            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              style={{
                backgroundColor: "#0A1628",
                borderRadius: 16,
                padding: 20,
                fontSize: 16,
                color: "#fff",
                borderWidth: 2,
                borderColor: "#22D3EE33",
              }}
            />

            {/* Login Button */}
            <TouchableOpacity onPress={handleLogin} disabled={loading} style={{ marginTop: 30 }}>
              <LinearGradient
                colors={["#22D3EE", "#8EF264"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 16,
                  padding: 20,
                  alignItems: "center",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#0A1628" size="small" />
                ) : (
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "bold",
                      color: "#0A1628",
                    }}
                  >
                    Sign In
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Sign Up Link */}
          <TouchableOpacity
            onPress={() => router.push("/auth/signup")}
            style={{ marginTop: 30, alignItems: "center" }}
            disabled={loading}
          >
            <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
              Don't have an account?{" "}
              <Text style={{ color: "#22D3EE", fontWeight: "600" }}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingAnimatedView>
    </View>
  );
}
