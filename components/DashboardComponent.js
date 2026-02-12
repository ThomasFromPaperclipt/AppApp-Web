import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Image,
} from "react-native";
import { AnimatedCircularProgress } from "react-native-circular-progress";
import Ionicons from "@expo/vector-icons/Ionicons";

import { getFunctions, httpsCallable } from "firebase/functions";

const DashboardView = ({
  isDashboardVisible,
  counts,
  applicationReadinessScore,
  boosts,
  tips,
  opacity,
  onToggleDashboard,
  CountdownTimer,
}) => {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  if (!isDashboardVisible) {
    return (
      <TouchableOpacity style={styles.countGrid} onPress={onToggleDashboard}>
        <View style={styles.countItem}>
          <Text style={styles.countText}>
            {counts.honors} {counts.honors === 1 ? "honor" : "honors"}
          </Text>
        </View>

        <View style={styles.countItem}>
          <Text style={styles.countText}>
            {counts.tests} {counts.tests === 1 ? "test" : "tests"}
          </Text>
        </View>
        <View style={styles.countItem}>
          <Text style={styles.countText}>
            {counts.activities}{" "}
            {counts.activities === 1 ? "activity" : "activities"}
          </Text>
        </View>
        <View style={styles.countItem}>
          <Text style={styles.countText}>
            {counts.essays} {counts.essays === 1 ? "essay" : "essays"}
          </Text>
        </View>
        <View style={styles.countItem}>
          <Text style={styles.countText}>
            {counts.colleges} {counts.colleges === 1 ? "college" : "colleges"}
          </Text>
        </View>
        <Animated.Text style={[styles.pointInfo, { opacity }]}>
          Tap to reveal your Application Readiness Score!
        </Animated.Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.gaugeContainer}>
      <Text style={styles.gaugeHeading}>Application Readiness Score</Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={styles.gaugeSubheading}>Calculated by Neil Appstrong</Text>
        <Image
          source={require("../assets/calculating.png")}
          style={styles.calculatingNeil}
        />
      </View>

      <AnimatedCircularProgress
        size={300}
        width={30}
        fill={(applicationReadinessScore / 600) * 100}
        tintColor="#00e0ff"
        backgroundColor="#3d5875"
        arcSweepAngle={300}
        rotation={210}
        lineCap="round"
      >
        {() => (
          <View>
            <Image
              source={require("../assets/hiThere.png")}
              style={styles.scoreNeil}
            />
            <Text style={styles.gaugeText}>
              {applicationReadinessScore}/600
            </Text>
          </View>
        )}
      </AnimatedCircularProgress>

      <Text style={styles.tipsHeader}>Your Boosts:</Text>
      <View style={styles.tipsContainer}>
        {boosts.map((boost, index) => (
          <View key={index} style={styles.tip}>
            <Text style={styles.tipText}>{boost}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.tipsHeader}>Suggestions:</Text>
      <View style={styles.tipsContainer}>
        {tips.map((tip, index) => (
          <View key={index} style={styles.tip}>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      <CountdownTimer />

      <View style={styles.disclaimerContainer}>
        <TouchableOpacity
          onPress={() => setShowDisclaimer(!showDisclaimer)}
          style={styles.infoButton}
        >
          <Ionicons name="information-circle-outline" size={18} color="#fff" />
          <Text style={styles.infoButtonText}>Important Info</Text>
        </TouchableOpacity>

        {showDisclaimer && (
          <Text style={styles.pointInfo}>
            The Application Readiness Score is a tool meant to give you an idea
            of how to generally enhance your application. It is not an indicator
            of your chances of getting into any college. AI can make mistakes.
            Always double check the output.
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={onToggleDashboard}>
        <Ionicons
          name="close"
          size={24}
          color="#fff"
          style={styles.closeIcon}
        />
        <Text style={styles.closeButtonText}>Close Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: "#D3D3D3",
    alignContent: "center",
    justifyContent: "center",
  },
  logo: {
    width: 110,
    height: 35,
    alignSelf: "center",
    shadowOpacity: 0.3,
    shadowOffset: 90,
    shadowRadius: 5,
    marginTop: 10,
  },
  liftoff: {
    width: 195,
    height: 210,
    alignSelf: "center",
  },
  hiThere: {
    width: 100,
    height: 120,
    alignSelf: "center",
  },
  scoreNeil: {
    marginTop: 30,
    width: 120,
    height: 140,
    alignSelf: "center",
  },
  calculatingNeil: {
    width: 65,
    height: 45,
    alignSelf: "center",
    marginLeft: 10,
    marginTop: -15,
  },
  welcomeText: {
    fontFamily: "Bukhari",
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginTop: 5,
    shadowOpacity: 0.1,
    shadowOffset: 90,
    shadowRadius: 5,
    padding: 8,
  },
  subtitle: {
    fontFamily: "Poppins",
    fontSize: 28,
    color: "white",
    textAlign: "center",
    marginVertical: 10,
    top: 25,
    shadowOpacity: 0.4,
    shadowOffset: 90,
    shadowRadius: 2.5,
  },
  points: {
    fontFamily: "Staat",
    fontSize: 32,
    color: "#327D93",
    textAlign: "center",
  },
  badgeHeader: {
    fontFamily: "Staat",
    fontSize: 22,
    color: "#fff",
    textAlign: "center",
  },
  pointInfo: {
    fontFamily: "DMSans",
    fontSize: 12,
    color: "#fff",
    textAlign: "center",
    marginTop: 13,
  },
  pointsBox: {
    flex: 1,
    alignSelf: "center",
    alignContent: "center",
    width: "95%",
    borderRadius: 10,
    shadowOpacity: 0.4,
    shadowOffset: 90,
    shadowRadius: 2.5,
    marginTop: 5,
    marginBottom: 5,
  },
  info: {
    fontFamily: "Abel",
    fontSize: 30,
    color: "white",
    textAlign: "center",
    marginVertical: 16,
  },
  resources: {
    fontFamily: "Abel",
    fontSize: 22,
    fontWeight: "900",
    color: "white",
    textAlign: "center",
    marginVertical: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignContent: "center",
    backgroundColor: "white",
    paddingVertical: 15,
    position: "absolute",
    width: "95.25%",
    borderRadius: 24,
    bottom: 17,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: 90,
    shadowRadius: 15,
  },
  button: {
    alignItems: "center",
    position: "relative",
  },
  Box: {
    top: 20,
    flex: 1,
    alignSelf: "center",
    alignContent: "center",
    width: "95%",
    borderWidth: 3,
    borderColor: "white",
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    shadowOpacity: 0.4,
    shadowOffset: 90,
    shadowRadius: 2.5,
    madWidth: "90%",
    padding: 5,
  },
  paddingView: {
    height: 30,
  },
  resourceItem: {
    padding: 10,
    borderBottomWidth: 2,
    marginLeft: 7,
    marginRight: 7,
    borderBottomColor: "#fff",
  },
  resourceTitle: {
    fontFamily: "Poppins",
    fontSize: 22,
    color: "white",
  },
  resourceText: {
    fontFamily: "Abel",
    fontSize: 18,
    color: "white",
  },
  sponsoredText: {
    fontFamily: "Poppins",
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.5)",
  },
  dashboardText: {
    fontFamily: "Poppins",
    textAlign: "center",
    fontSize: 26,
    color: "white",
    padding: 15,
  },
  countGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: 5,
    marginTop: 5,
  },
  countItem: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    borderRadius: 15,
    height: 50,
    padding: 10,
    margin: 3,
    width: "30%",
  },
  countText: {
    fontFamily: "Staat",
    fontSize: 20,
    color: "white",
    textAlign: "center",
    shadowOpacity: 0.2,
    shadowOffset: 90,
    shadowRadius: 2.5,
  },
  badgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 12,
    padding: 10,
    margin: 5,
  },
  badgeText: {
    fontFamily: "Staat",
    fontSize: 17,
    color: "white",
    textAlign: "center",
    shadowOpacity: 0.2,
    shadowOffset: 90,
    shadowRadius: 2,
  },
  animationBox: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 600,
    zIndex: 1,
  },
  gaugeContainer: {
    alignItems: "center",
    marginTop: 10,
  },
  gaugeText: {
    fontFamily: "Staat",
    fontSize: 30,
    color: "white",
    textAlign: "center",
    marginTop: 20,
  },
  gaugeHeading: {
    fontFamily: "Staat",
    fontSize: 31,
    color: "white",
    textAlign: "center",
  },
  gaugeSubheading: {
    fontFamily: "Bukhari",
    fontSize: 20,
    marginBottom: 15,
    color: "white",
    textAlign: "center",
    padding: 3,
    flexWrap: "wrap",
  },
  tipsHeader: {
    fontFamily: "Staat",
    fontSize: 27,
    color: "#fff",
    textAlign: "center",
    marginTop: 15,
    marginBottom: -10,
  },
  tipsContainer: {
    marginTop: 10,
    alignItems: "center",
    width: "100%",
    maxWidth: "auto",
  },
  tip: {
    backgroundColor: "rgba(61, 88, 117, 0.3)",
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 12,
    padding: 12,
    margin: 5,
    width: "95%",
  },
  tipText: {
    fontFamily: "Poppins",
    fontSize: 15,
    color: "#fff",
    textAlign: "left",
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(61, 88, 117, 0.3)",
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 12,
    padding: 5,
    marginTop: 20,
    marginBottom: 10,
    width: "60%",
  },
  closeButtonText: {
    fontFamily: "Poppins",
    fontSize: 16,
    color: "#fff",
    marginLeft: 8,
  },
  closeIcon: {
    marginRight: 4,
  },
  disclaimerContainer: {
    alignItems: "center",
    marginTop: 10,
  },
  infoButton: {
    flexDirection: "row",
    alignContent: "center",
    justifyContent: "center",
    verticalAlign: "center",
    marginBottom: -10,
  },
  infoButtonText: {
    fontFamily: "DMSans",
    fontSize: 12,
    color: "#fff",
    textAlign: "center",
    alignSelf: "center",
    marginLeft: 5,
  },
});

export default DashboardView;
