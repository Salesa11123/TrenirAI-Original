import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Apple, Plus } from "lucide-react-native";

export default function Nutrition() {
  const insets = useSafeAreaInsets();

  const macros = {
    protein: { current: 120, target: 150, color: "#22D3EE" },
    carbs: { current: 180, target: 200, color: "#8EF264" },
    fats: { current: 50, target: 60, color: "#F59E0B" },
  };

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
            marginBottom: 8,
          }}
        >
          Nutrition
        </Text>
        <Text style={{ fontSize: 16, color: "#9CA3AF", marginBottom: 24 }}>
          Track your daily intake
        </Text>

        {/* Calories Overview */}
        <View
          style={{
            backgroundColor: "#0F1E32",
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: "#22D3EE22",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 16, color: "#9CA3AF", marginBottom: 8 }}>
            Today's Calories
          </Text>
          <Text
            style={{
              fontSize: 48,
              fontWeight: "bold",
              color: "#fff",
              marginBottom: 4,
            }}
          >
            1,850
          </Text>
          <Text style={{ fontSize: 14, color: "#22D3EE" }}>/ 2,200 kcal</Text>

          <View
            style={{
              width: "100%",
              height: 8,
              backgroundColor: "#0A1628",
              borderRadius: 4,
              overflow: "hidden",
              marginTop: 16,
            }}
          >
            <View
              style={{
                width: "84%",
                height: "100%",
                backgroundColor: "#22D3EE",
                borderRadius: 4,
              }}
            />
          </View>
        </View>

        {/* Log Meal Button */}
        <TouchableOpacity
          style={{
            backgroundColor: "#8EF264",
            borderRadius: 16,
            padding: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 24,
          }}
        >
          <Plus color="#0A1628" size={24} />
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "#0A1628" }}>
            Log Meal
          </Text>
        </TouchableOpacity>

        {/* Macros Distribution */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: "bold",
            color: "#fff",
            marginBottom: 16,
          }}
        >
          Macros Distribution
        </Text>

        {Object.entries(macros).map(([name, data]) => (
          <View
            key={name}
            style={{
              backgroundColor: "#0F1E32",
              borderRadius: 16,
              padding: 20,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: `${data.color}22`,
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
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#fff",
                  textTransform: "capitalize",
                }}
              >
                {name}
              </Text>
              <Text
                style={{ fontSize: 14, color: data.color, fontWeight: "600" }}
              >
                {data.current}g / {data.target}g
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
                  width: `${(data.current / data.target) * 100}%`,
                  height: "100%",
                  backgroundColor: data.color,
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        ))}

        {/* Meal History */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: "bold",
            color: "#fff",
            marginTop: 8,
            marginBottom: 16,
          }}
        >
          Today's Meals
        </Text>

        {["Breakfast", "Lunch", "Snack"].map((meal, index) => (
          <TouchableOpacity
            key={index}
            style={{
              backgroundColor: "#0F1E32",
              borderRadius: 16,
              padding: 20,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: "#22D3EE22",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "#8EF26422",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Apple color="#8EF264" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#fff",
                  marginBottom: 4,
                }}
              >
                {meal}
              </Text>
              <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
                {index === 0 ? "450" : index === 1 ? "680" : "220"} kcal
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
