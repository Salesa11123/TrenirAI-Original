import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Apple,
  CheckCircle2,
  Plus,
  Search,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react-native";
import * as SecureStore from "expo-secure-store";

const defaultTargets = { calories: 2200, protein: 140, carbs: 240, fats: 70 };
const mealTypes = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

const parseBaseQuantity = (unit) => {
  if (!unit) return 1;
  const match = `${unit}`.match(/([\d.]+)/);
  const parsed = match ? parseFloat(match[1]) : null;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const scaleMacros = (food, quantity) => {
  if (!food) return null;
  const base = parseBaseQuantity(food.unit);
  const factor = base ? Number(quantity || 0) / base : Number(quantity || 0);
  const round = (val) =>
    Math.round((Number(val || 0) * factor + Number.EPSILON) * 100) / 100;
  return {
    calories: round(food.calories),
    protein: round(food.protein),
    carbs: round(food.carbs),
    fats: round(food.fats),
  };
};

export default function Nutrition() {
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(today);

  const [summary, setSummary] = useState({
    date: today,
    totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
    targets: defaultTargets,
    meals: [],
  });
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [globalScope, setGlobalScope] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState("100");
  const [mealType, setMealType] = useState("breakfast");
  const [savingMeal, setSavingMeal] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDays, setCalendarDays] = useState([]);

  const BASE_URL =
    Platform.OS === "android"
      ? "http://10.0.2.2:4000"
      : "http://192.168.1.110:4000";
  const authFetch = async (path, options = {}) => {
    const token = await SecureStore.getItemAsync("token");
    if (!token) throw new Error("Not authenticated");
    return fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  };

  useEffect(() => {
    loadSummary(selectedDate);
  }, [selectedDate]);

  const loadSummary = async (date) => {
    setLoading(true);
    try {
      const res = await authFetch(
        `/nutrition/today${date ? `?date=${date}` : ""}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary({
        date: data.date || date || today,
        totals: data.totals || { calories: 0, protein: 0, carbs: 0, fats: 0 },
        targets: data.targets || defaultTargets,
        meals: data.meals || [],
      });
    } catch (err) {
      console.error("Load nutrition error:", err);
      setSearchError("Could not load nutrition. Pull to retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setSearchError("Enter at least 2 characters to search.");
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const res = await authFetch(
        `/nutrition/search?q=${encodeURIComponent(searchQuery)}${
          globalScope ? "&scope=global" : ""
        }`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        setSearchError("No foods found in OpenFoodFacts or your saved items.");
      }
    } catch (err) {
      console.error("Search food error:", err);
      setSearchError("Food search failed. Check connection and try again.");
    } finally {
      setSearching(false);
    }
  };

  const selectedMacros = useMemo(
    () => scaleMacros(selectedFood, Number(quantity)),
    [selectedFood, quantity]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (logOpen && searchQuery.length >= 2) {
        handleSearch();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, globalScope, logOpen]);

  const logMeal = async () => {
    if (!selectedFood) {
      Alert.alert("Pick a food", "Select a food item from search results.");
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      Alert.alert("Quantity required", "Enter how much you consumed.");
      return;
    }

    setSavingMeal(true);
    try {
      const payload = {
        foodItemId: selectedFood.id,
        foodName: selectedFood.name,
        unit: selectedFood.unit,
        calories: selectedFood.calories,
        protein: selectedFood.protein,
        carbs: selectedFood.carbs,
        fats: selectedFood.fats,
        quantity: qty,
        mealType,
        consumedAt: selectedDate,
      };

      const res = await authFetch(`/nutrition/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.summary) setSummary(data.summary);
      setSelectedFood(null);
      setQuantity("100");
      setMealType("breakfast");
      setSearchResults([]);
      setSearchQuery("");
      setLogOpen(false);
    } catch (err) {
      console.error("Log meal error:", err);
      Alert.alert("Save failed", err.message || "Could not log meal.");
    } finally {
      setSavingMeal(false);
    }
  };

  const deleteMeal = async (meal) => {
    if (!meal?.id) return;
    try {
      const res = await authFetch(`/nutrition/log/${meal.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
    } catch (err) {
      console.error("Delete meal error:", err);
      Alert.alert("Delete failed", err.message || "Could not delete meal.");
    }
  };

  const caloriesTarget = summary.targets?.calories || defaultTargets.calories;
  const caloriesValue = summary.totals?.calories || 0;
  const caloriesOver = caloriesValue > caloriesTarget;
  const caloriesDelta = Math.abs(caloriesTarget - caloriesValue);
  const caloriesProgress = Math.min(
    caloriesValue / (caloriesTarget || 1),
    1
  );
  const caloriesBarColor = caloriesOver ? "#EF4444" : "#22D3EE";

  const macroConfig = [
    {
      key: "protein",
      label: "Protein",
      color: "#22D3EE",
      current: summary.totals?.protein || 0,
      target: summary.targets?.protein || defaultTargets.protein,
    },
    {
      key: "carbs",
      label: "Carbs",
      color: "#8EF264",
      current: summary.totals?.carbs || 0,
      target: summary.targets?.carbs || defaultTargets.carbs,
    },
    {
      key: "fats",
      label: "Fats",
      color: "#F59E0B",
      current: summary.totals?.fats || 0,
      target: summary.targets?.fats || defaultTargets.fats,
    },
  ];

  const groupedMeals = useMemo(() => {
    const groups = { breakfast: [], lunch: [], dinner: [], snack: [], other: [] };
    (summary.meals || []).forEach((meal) => {
      const key = (meal.meal_type || "other").toString().toLowerCase();
      if (groups[key]) {
        groups[key].push(meal);
      } else {
        groups.other.push(meal);
      }
    });
    return groups;
  }, [summary.meals]);

  const mealCards = Object.entries(groupedMeals).filter(
    ([, items]) => items.length > 0
  );

  const changeDate = (delta) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    setSelectedDate(next.toISOString().slice(0, 10));
  };

  const loadCalendarDays = async () => {
    const days = [];
    const base = new Date(selectedDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      try {
        const res = await authFetch(`/nutrition/today?date=${iso}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const target = data?.targets?.calories || caloriesTarget;
        const total = data?.totals?.calories || 0;
        const pct = target ? Math.min(total / target, 2) : 0;
        days.push({ date: iso, pct, total, target });
      } catch {
        days.push({ date: iso, pct: 0, total: 0, target: caloriesTarget });
      }
    }
    setCalendarDays(days);
  };

  useEffect(() => {
    if (calendarOpen) {
      loadCalendarDays();
    }
  }, [calendarOpen, selectedDate]);

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
            fontSize: 30,
            fontWeight: "800",
            color: "#fff",
            marginBottom: 6,
          }}
        >
          Nutrition
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              onPress={() => changeDate(-1)}
              style={{
                padding: 8,
                borderRadius: 12,
                backgroundColor: "#0F1E32",
                borderWidth: 1,
                borderColor: "#22D3EE22",
              }}
            >
              <ChevronLeft color="#E5E7EB" size={18} />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 16,
                color: "#fff",
                fontWeight: "700",
              }}
            >
              {selectedDate}
            </Text>
            <TouchableOpacity
              onPress={() => changeDate(1)}
              style={{
                padding: 8,
                borderRadius: 12,
                backgroundColor: "#0F1E32",
                borderWidth: 1,
                borderColor: "#22D3EE22",
              }}
            >
              <ChevronRight color="#E5E7EB" size={18} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => setCalendarOpen(true)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 12,
              backgroundColor: "#0F1E32",
              borderWidth: 1,
              borderColor: "#22D3EE33",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CalendarDays color="#22D3EE" size={18} />
            <Text style={{ color: "#E5E7EB", fontWeight: "700" }}>Kalendar</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: "#0F1E32",
            borderRadius: 16,
            padding: 24,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: "#22D3EE22",
          }}
        >
          <Text style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 8 }}>
            Today's Calories
          </Text>
          <Text
            style={{
              fontSize: 46,
              fontWeight: "800",
              color: caloriesOver ? "#F87171" : "#fff",
              marginBottom: 4,
            }}
          >
            {Math.round(caloriesValue)}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: caloriesOver ? "#F87171" : "#22D3EE",
            }}
          >
            / {caloriesTarget} kcal
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: caloriesOver ? "#F87171" : "#8EF264",
              marginTop: 4,
              fontWeight: "700",
            }}
          >
            {caloriesOver
              ? `Over by ${Math.round(caloriesDelta)} kcal`
              : `Remaining ${Math.round(caloriesDelta)} kcal`}
          </Text>

          <View
            style={{
              width: "100%",
              height: 10,
              backgroundColor: "#0A1628",
              borderRadius: 5,
              overflow: "hidden",
              marginTop: 16,
            }}
          >
            <View
              style={{
                width: `${caloriesProgress * 100}%`,
                height: "100%",
                backgroundColor: caloriesBarColor,
                borderRadius: 5,
              }}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setLogOpen(true)}
          style={{
            backgroundColor: "#8EF264",
            borderRadius: 16,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 22,
          }}
        >
          <Plus color="#0A1628" size={22} />
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#0A1628" }}>
            Log Meal
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 19,
            fontWeight: "800",
            color: "#fff",
            marginBottom: 12,
          }}
        >
          Macros Distribution
        </Text>

        {macroConfig.map((macro) => {
          const pct = Math.min(macro.current / (macro.target || 1), 1);
          const over = macro.current > macro.target;
          const barColor = over ? "#EF4444" : macro.color;
          const delta = Math.abs(macro.target - macro.current);
          return (
            <View
              key={macro.key}
              style={{
                backgroundColor: "#0F1E32",
                borderRadius: 16,
                padding: 16,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: `${macro.color}33`,
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
                    fontSize: 15,
                    fontWeight: "700",
                    color: "#fff",
                  }}
                >
                  {macro.label}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: barColor,
                    fontWeight: "700",
                  }}
                >
                  {macro.current}g / {macro.target}g
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
                      width: `${pct * 100}%`,
                      height: "100%",
                      backgroundColor: barColor,
                      borderRadius: 4,
                    }}
                  />
                </View>
              <Text
                style={{
                  color: over ? "#F87171" : "#8EF264",
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {over
                  ? `Over by ${delta.toFixed(2)}g`
                  : `Remaining ${delta.toFixed(2)}g`}
              </Text>
            </View>
          );
        })}

        <Text
          style={{
            fontSize: 19,
            fontWeight: "800",
            color: "#fff",
            marginTop: 12,
            marginBottom: 12,
          }}
        >
          Today's Meals
        </Text>

        {loading ? (
          <ActivityIndicator color="#22D3EE" />
        ) : mealCards.length === 0 ? (
          <View
            style={{
              backgroundColor: "#0F1E32",
              borderRadius: 14,
              padding: 18,
              borderWidth: 1,
              borderColor: "#22D3EE22",
            }}
          >
            <Text style={{ color: "#E5E7EB", fontWeight: "700", marginBottom: 4 }}>
              No meals logged yet
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 13 }}>
              Add your first meal to start tracking calories and macros.
            </Text>
          </View>
        ) : (
          mealCards.map(([type, items]) => (
            <View key={type} style={{ marginBottom: 12 }}>
              <Text
                style={{
                  color: "#9CA3AF",
                  marginBottom: 8,
                  textTransform: "capitalize",
                  fontWeight: "700",
                }}
              >
                {type}
              </Text>
              {items.map((meal) => (
                <View
                  key={meal.id}
                  style={{
                    backgroundColor: "#0F1E32",
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "#22D3EE22",
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: "#8EF26422",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Apple color="#8EF264" size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: "#fff",
                        marginBottom: 4,
                      }}
                    >
                      {meal.food_name || "Food item"}
                    </Text>
                    <Text style={{ color: "#9CA3AF", fontSize: 13 }}>
                      {meal.calories} kcal - {meal.protein}P / {meal.carbs}C /{" "}
                      {meal.fats}F
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    <Text style={{ color: "#8EF264", fontWeight: "700" }}>
                      {meal.calories} kcal
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert("Delete meal?", "This will remove the entry.", [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deleteMeal(meal),
                          },
                        ])
                      }
                      style={{
                        padding: 6,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "#EF444422",
                      }}
                    >
                      <Trash2 color="#EF4444" size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <MealModal
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        selectedDate={selectedDate}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        searchResults={searchResults}
        searching={searching}
        searchError={searchError}
        globalScope={globalScope}
        setGlobalScope={setGlobalScope}
        selectedFood={selectedFood}
        setSelectedFood={setSelectedFood}
        quantity={quantity}
        setQuantity={setQuantity}
        mealType={mealType}
        setMealType={setMealType}
        selectedMacros={selectedMacros}
        onSave={logMeal}
        saving={savingMeal}
        recentMeals={(summary.meals || []).slice(0, 5)}
      />
      <CalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        days={calendarDays}
        onSelect={(date) => {
          setSelectedDate(date);
          setCalendarOpen(false);
        }}
      />
    </View>
  );
}

function MealModal({
  visible,
  onClose,
  selectedDate,
  searchQuery,
  setSearchQuery,
  onSearch,
  searchResults,
  searching,
  searchError,
  globalScope,
  setGlobalScope,
  selectedFood,
  setSelectedFood,
  quantity,
  setQuantity,
  mealType,
  setMealType,
  selectedMacros,
  onSave,
  saving,
  recentMeals = [],
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View
            style={{
              flex: 1,
              backgroundColor: "#0A1628",
              paddingTop: 20,
              paddingHorizontal: 20,
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
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
            Log Meal
          </Text>
          <TouchableOpacity onPress={onClose}>
            <X color="#9CA3AF" size={22} />
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: "#0F1E32",
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: "#22D3EE22",
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Search color="#22D3EE" size={18} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search real foods (OpenFoodFacts + saved)"
              placeholderTextColor="#6B7280"
              style={{
                flex: 1,
                color: "#fff",
                paddingVertical: 8,
              }}
              returnKeyType="search"
              onSubmitEditing={onSearch}
            />
            <TouchableOpacity
              onPress={onSearch}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: "#22D3EE",
                borderRadius: 10,
              }}
            >
              {searching ? (
                <ActivityIndicator color="#0A1628" />
              ) : (
                <Text
                  style={{ color: "#0A1628", fontWeight: "800", fontSize: 13 }}
                >
                  Search
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
              Global results (eng) fallback
            </Text>
            <TouchableOpacity
              onPress={() => setGlobalScope(!globalScope)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: globalScope ? "#22D3EE22" : "#0A1628",
                borderWidth: 1,
                borderColor: globalScope ? "#22D3EE66" : "#22D3EE22",
              }}
            >
              <Text
                style={{
                  color: globalScope ? "#22D3EE" : "#E5E7EB",
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {globalScope ? "On" : "Off"}
              </Text>
            </TouchableOpacity>
          </View>
          {searchError ? (
            <Text style={{ color: "#F97316", marginTop: 8, fontSize: 12 }}>
              {searchError}
            </Text>
          ) : null}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {recentMeals.length > 0 ? (
            <View
              style={{
                backgroundColor: "#0F1E32",
                borderRadius: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: "#22D3EE22",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: "#E5E7EB",
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                Recent (tap to reuse)
              </Text>
              {recentMeals.map((meal) => (
                <TouchableOpacity
                  key={meal.id}
                  onPress={() => {
                    setSelectedFood({
                      id: meal.food_item_id,
                      name: meal.food_name || "Food item",
                      unit: meal.food_unit || "1 serving",
                      calories: meal.calories,
                      protein: meal.protein,
                      carbs: meal.carbs,
                      fats: meal.fats,
                    });
                    setQuantity(String(meal.quantity || "1"));
                    setMealType((meal.meal_type || "breakfast").toLowerCase());
                  }}
                  style={{
                    paddingVertical: 10,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottomWidth: 1,
                    borderBottomColor: "#22D3EE22",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text
                      style={{ color: "#fff", fontWeight: "700" }}
                      numberOfLines={1}
                    >
                      {meal.food_name || "Food item"}
                    </Text>
                    <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                      {meal.quantity} {meal.food_unit || "g"} - {meal.calories} kcal
                    </Text>
                  </View>
                  <Text style={{ color: "#22D3EE", fontWeight: "700" }}>
                    {meal.meal_type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {(searchResults || []).map((item) => {
            const active = selectedFood?.id === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSelectedFood(item)}
                style={{
                  backgroundColor: active ? "#12233A" : "#0F1E32",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: active ? "#8EF26466" : "#22D3EE22",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: "#fff", fontWeight: "700", marginBottom: 4 }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                    {item.unit || "1 serving"} • {item.calories} kcal •{" "}
                    {item.protein}P / {item.carbs}C / {item.fats}F{" "}
                    {item.region ? `• ${item.region}` : ""}
                  </Text>
                </View>
                {active ? <CheckCircle2 color="#8EF264" size={22} /> : null}
              </TouchableOpacity>
            );
          })}

          {selectedFood ? (
            <View
              style={{
                backgroundColor: "#0F1E32",
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: "#8EF26444",
                marginTop: 6,
                gap: 12,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                Portion & Macros
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#9CA3AF", marginBottom: 6 }}>
                    Quantity (g)
                  </Text>
                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor="#6B7280"
                    style={{
                      backgroundColor: "#0A1628",
                      borderRadius: 10,
                      padding: 12,
                      color: "#fff",
                      borderWidth: 1,
                      borderColor: "#22D3EE33",
                    }}
                  />
                  <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
                    {selectedFood.unit || "1 serving"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#9CA3AF", marginBottom: 6 }}>Meal type</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {mealTypes.map((type) => {
                      const active = mealType === type.key;
                      return (
                        <TouchableOpacity
                          key={type.key}
                          onPress={() => setMealType(type.key)}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 10,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: active ? "#8EF264AA" : "#22D3EE33",
                            backgroundColor: active ? "#8EF26422" : "#0A1628",
                          }}
                        >
                          <Text
                            style={{
                              color: active ? "#8EF264" : "#E5E7EB",
                              fontWeight: "700",
                              fontSize: 13,
                            }}
                          >
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {selectedMacros ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {[
                    { label: "Kcal", value: selectedMacros.calories, color: "#22D3EE" },
                    { label: "Protein", value: `${selectedMacros.protein} g`, color: "#22D3EE" },
                    { label: "Carbs", value: `${selectedMacros.carbs} g`, color: "#8EF264" },
                    { label: "Fats", value: `${selectedMacros.fats} g`, color: "#F59E0B" },
                  ].map((item) => (
                    <View
                      key={item.label}
                      style={{
                        flex: 1,
                        backgroundColor: "#0A1628",
                        borderRadius: 10,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: `${item.color}33`,
                      }}
                    >
                      <Text
                        style={{
                          color: "#9CA3AF",
                          fontSize: 12,
                          marginBottom: 4,
                        }}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={{ color: item.color, fontWeight: "800", fontSize: 15 }}
                      >
                        {item.value}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity
                onPress={onSave}
                disabled={saving}
                style={{
                  backgroundColor: "#8EF264",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  marginTop: 6,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#0A1628" />
                ) : (
                  <Text
                    style={{
                      color: "#0A1628",
                      fontWeight: "800",
                      fontSize: 15,
                    }}
                  >
                    Save meal
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CalendarModal({ visible, onClose, days = [], onSelect }) {
  const ringColor = (pct) => (pct > 1 ? "#EF4444" : "#22D3EE");
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#0A1628",
          paddingTop: 20,
          paddingHorizontal: 20,
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
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
            Dnevni pregled
          </Text>
          <TouchableOpacity onPress={onClose}>
            <X color="#9CA3AF" size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        >
          {days.map((d) => {
            const pct = Math.min(d.pct || 0, 2);
            const color = ringColor(pct);
            const fillPct = Math.round(Math.min(pct, 1) * 100);
            const overText = pct > 1 ? "Over" : "On track";
            return (
              <TouchableOpacity
                key={d.date}
                onPress={() => onSelect && onSelect(d.date)}
                style={{
                  backgroundColor: "#0F1E32",
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#22D3EE22",
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 10,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    borderWidth: 4,
                    borderColor: color,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0A1628",
                  }}
                >
                  <Text
                    style={{
                      color: color,
                      fontWeight: "800",
                      fontSize: 13,
                    }}
                  >
                    {fillPct}%
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: "#fff", fontWeight: "700", marginBottom: 4 }}
                  >
                    {d.date}
                  </Text>
                  <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                    {Math.round(d.total || 0)} / {Math.round(d.target || 0)} kcal
                  </Text>
                </View>
                <Text
                  style={{
                    color,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {overText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
