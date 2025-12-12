import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Platform } from "react-native";
import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/utils/auth/useAuth";

export default function Index() {
  const { isReady, isAuthenticated } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  const BASE_URL =
    Platform.OS === "android"
      ? "http://10.0.2.2:4000"
      : "http://192.168.0.10:4000";

  useEffect(() => {
    let cancelled = false;

    async function checkProfile() {
      console.log("🏠 Index checkProfile()", { isReady, isAuthenticated });

      // auth još nije spreman
      if (!isReady) {
        if (!cancelled) setCheckingProfile(true);
        return;
      }

      // nije ulogovan
      if (!isAuthenticated) {
        if (!cancelled) {
          setHasProfile(false);
          setCheckingProfile(false);
        }
        return;
      }

      try {
        const token = await SecureStore.getItemAsync("token");
        console.log("🔐 token:", token);

        if (!token) {
          if (!cancelled) {
            setHasProfile(false);
            setCheckingProfile(false);
          }
          return;
        }

        const url = `${BASE_URL}/users/profile`;
        console.log("🌐 GET", url);

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("📡 Profile status:", res.status);

        // Ključna stvar:
        // - Ako je 200 OK → profil postoji (ne mora da vraća {exists:true})
        if (res.ok) {
          let data = null;
          try {
            data = await res.json();
          } catch (e) {
            // ako nema JSON-a, i dalje tretiramo kao OK
          }

          console.log("📨 Profile body:", data);

          const exists =
            data?.exists === true ||
            data?.id != null ||
            data?.profile?.id != null ||
            true; // res.ok je dovoljan signal

          if (!cancelled) setHasProfile(!!exists);
        } else {
          // 404 = nema profila
          if (!cancelled) setHasProfile(false);
        }
      } catch (e) {
        console.error("💥 checkProfile error:", e);
        if (!cancelled) setHasProfile(false);
      } finally {
        if (!cancelled) setCheckingProfile(false);
      }
    }

    checkProfile();
    return () => {
      cancelled = true;
    };
  }, [isReady, isAuthenticated]);

  // loading
  if (!isReady || checkingProfile) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0A1628",
        }}
      >
        <ActivityIndicator size="large" color="#22D3EE" />
        <Text style={{ color: "#fff", marginTop: 20 }}>Loading...</Text>
      </View>
    );
  }

  // nije ulogovan -> welcome
  if (!isAuthenticated) {
    return <Redirect href="/auth/welcome" />;
  }

  // ulogovan ali nema profil -> onboarding
  if (!hasProfile) {
    return <Redirect href="/auth/onboarding" />;
  }

  // ulogovan + ima profil -> workouts (stavi tačnu rutu)
  return <Redirect href="/workouts" />;
}
