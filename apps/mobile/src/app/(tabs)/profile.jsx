import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  User,
  Settings,
  Trophy,
  Target,
  Bell,
  HelpCircle,
  LogOut,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/utils/auth/useAuth";

export default function Profile() {
  const router = useRouter();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const menuItems = [
    { icon: Settings, label: "Settings", color: "#22D3EE" },
    { icon: Trophy, label: "Achievements", color: "#8EF264" },
    { icon: Target, label: "Goals", color: "#F59E0B" },
    { icon: Bell, label: "Notifications", color: "#22D3EE" },
    { icon: HelpCircle, label: "Help & Support", color: "#9CA3AF" },
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
            marginBottom: 24,
          }}
        >
          Profile
        </Text>

        {/* User Info Card */}
        <View
          style={{
            backgroundColor: "#0F1E32",
            borderRadius: 16,
            padding: 24,
            marginBottom: 32,
            borderWidth: 1,
            borderColor: "#22D3EE22",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#22D3EE22",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              borderWidth: 2,
              borderColor: "#22D3EE",
            }}
          >
            <User color="#22D3EE" size={40} />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              color: "#fff",
              marginBottom: 4,
            }}
          >
            John Doe
          </Text>
          <Text style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 16 }}>
            john.doe@email.com
          </Text>

          <View style={{ flexDirection: "row", gap: 24, marginTop: 8 }}>
            <View style={{ alignItems: "center" }}>
              <Text
                style={{ fontSize: 24, fontWeight: "bold", color: "#22D3EE" }}
              >
                42
              </Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF" }}>Workouts</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text
                style={{ fontSize: 24, fontWeight: "bold", color: "#8EF264" }}
              >
                12
              </Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF" }}>Streak</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text
                style={{ fontSize: 24, fontWeight: "bold", color: "#F59E0B" }}
              >
                85kg
              </Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF" }}>Weight</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={{ gap: 12, marginBottom: 24 }}>
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={index}
                style={{
                  backgroundColor: "#0F1E32",
                  borderRadius: 16,
                  padding: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  borderWidth: 1,
                  borderColor: `${item.color}22`,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: `${item.color}22`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon color={item.color} size={20} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#fff",
                  }}
                >
                  {item.label}
                </Text>
                <Text style={{ fontSize: 20, color: "#9CA3AF" }}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={() => {
            signOut();
            router.replace("/auth/welcome");
          }}
          style={{
            backgroundColor: "#0F1E32",
            borderRadius: 16,
            padding: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderWidth: 1,
            borderColor: "#EF444422",
          }}
        >
          <LogOut color="#EF4444" size={20} />
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "#EF4444" }}>
            Log Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
