import { View, Text, TouchableOpacity, Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Sparkles } from "lucide-react-native";

export default function Welcome() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1628" }}>
      <StatusBar style="light" />

      <View
        style={{
          flex: 1,
          paddingHorizontal: 30,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Logo */}
        <Image
          source={{
            uri: "https://ucarecdn.com/a2115a77-6aa1-4d8b-8668-7d0d708e8dea/-/format/auto/",
          }}
          style={{
            width: 160,
            height: 160,
            marginBottom: 50,
          }}
          resizeMode="contain"
        />

        {/* Welcome Text */}
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Text
              style={{ fontSize: 28, fontWeight: "bold", color: "#22D3EE" }}
            >
              Welcome to TrenirAI
            </Text>
            
          </View>
          <Text
            style={{
              fontSize: 16,
              color: "#9CA3AF",
              textAlign: "center",
              paddingHorizontal: 20,
            }}
          >
            Create your account to start your fitness journey
          </Text>
        </View>

        {/* Progress Dots */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 60 }}>
          <View
            style={{
              width: 40,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#22D3EE",
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#ffffff33",
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#ffffff33",
            }}
          />
        </View>

        {/* Buttons */}
        <View style={{ width: "100%", gap: 16 }}>
          <TouchableOpacity
            onPress={() => router.push("/auth/signup")}
            style={{ width: "100%" }}
          >
            <LinearGradient
              colors={["#22D3EE", "#8EF264"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 16,
                padding: 20,
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: "bold", color: "#0A1628" }}
              >
                Get Started
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/auth/login")}
            style={{
              borderRadius: 16,
              padding: 20,
              alignItems: "center",
              borderWidth: 2,
              borderColor: "#22D3EE",
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: "bold", color: "#22D3EE" }}
            >
              Sign In
            </Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text
          style={{
            fontSize: 12,
            color: "#9CA3AF",
            textAlign: "center",
            marginTop: 40,
            paddingHorizontal: 40,
          }}
        >
          By creating an account, you agree to our{" "}
          <Text style={{ color: "#22D3EE" }}>Terms of Service</Text> and{" "}
          <Text style={{ color: "#22D3EE" }}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}
