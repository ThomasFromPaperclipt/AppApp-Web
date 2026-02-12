import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";

const CountdownTimer = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const difference = nextMonth - now;

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.countdownContainer}>
      <Text style={styles.countdownTitle}>Next AppApp Day Incoming:</Text>

      <View style={styles.timeGrid}>
        <View style={styles.timeItem}>
          <Text style={styles.timeValue}>{timeLeft.days}</Text>
          <Text style={styles.timeLabel}>D</Text>
        </View>
        <View style={styles.timeItem}>
          <Text style={styles.timeValue}>{timeLeft.hours}</Text>
          <Text style={styles.timeLabel}>H</Text>
        </View>
        <View style={styles.timeItem}>
          <Text style={styles.timeValue}>{timeLeft.minutes}</Text>
          <Text style={styles.timeLabel}>M</Text>
        </View>
        <View style={styles.timeItem}>
          <Text style={styles.timeValue}>{timeLeft.seconds}</Text>
          <Text style={styles.timeLabel}>S</Text>
        </View>
      </View>
      <Text style={styles.countdownSubtitle}>
        Your Updated Score & Insights Will Be Available Soon!
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  countdownContainer: {
    backgroundColor: "rgba(19, 81, 79, 0.57)",
    borderWidth: 3,
    borderColor: "white",
    borderRadius: 20,
    padding: 5,
    marginTop: 10,
    width: "98%",
    alignSelf: "center",
  },
  countdownTitle: {
    fontFamily: "Staat",
    fontSize: 23,
    color: "white",
    textAlign: "center",
    marginBottom: 5,
    marginTop: 5,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
  },
  countdownSubtitle: {
    fontFamily: "Poppins",
    fontSize: 12,
    color: "white",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 7,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
  },
  timeGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  timeItem: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    padding: 7,
    width: "22%",
  },
  timeValue: {
    fontFamily: "Bukhari",
    padding: 4,
    fontSize: 20,
    color: "white",
    textAlign: "center",
  },
  timeLabel: {
    fontFamily: "DMSans",
    fontSize: 12,
    color: "white",
    textAlign: "center",
  },
});

export default CountdownTimer;
