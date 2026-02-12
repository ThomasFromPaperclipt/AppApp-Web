import React from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import MarkdownDisplay from "react-native-markdown-display";

const CollegeRecommendations = ({ route }) => {
  const navigation = useNavigation();
  const rawResponse = route.params?.responseText || "";

  let recommendations;
  try {
    recommendations = JSON.parse(rawResponse);
  } catch (error) {
    console.error("Error parsing response:", error);
    recommendations = null;
  }

  if (!recommendations || !recommendations.text) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollView}>
          <Text style={styles.errorMessage}>Invalid response format.</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate("CollegeSearch")}
            >
              <Text style={styles.buttonText}>new search</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate("Home")}
            >
              <Text style={styles.buttonText}>return home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const parsedText = recommendations.text.split(/\n\n+/);

  // Styles for the markdown content
  const markdownStyles = {
    body: {
      fontSize: 16,
      color: "#E0E0E0",
      fontFamily: "DMSans",
      lineHeight: 24,
    },
    strong: {
      fontFamily: "Staat",
      fontSize: 20,
      color: "#fff",
    },
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        <Text style={styles.header}>Neil's Recommendations</Text>

        <Image
          source={require("../assets/AI_Flight.png")}
          style={styles.hiThere}
        />

        {parsedText.map((paragraph, index) => (
          <View key={index} style={styles.paragraphContainer}>
            <MarkdownDisplay style={markdownStyles}>
              {paragraph}
            </MarkdownDisplay>
          </View>
        ))}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("CollegeSearch")}
          >
            <Text style={styles.buttonText}>new search</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("Home")}
          >
            <Text style={styles.buttonText}>return home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2C3539",
  },
  scrollView: {
    padding: 16,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Bukhari",
  },
  paragraphContainer: {
    backgroundColor: "#2F4547",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#507579",
  },
  errorMessage: {
    fontSize: 16,
    color: "#FF6B6B",
    textAlign: "center",
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#2F4547",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FF6B6B",
  },
  buttonContainer: {
    gap: 12,
    marginTop: 20,
  },
  button: {
    backgroundColor: "#436164",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#507579",
  },
  hiThere: {
    width: 110,
    height: 150,
    marginBottom: 10,
    alignSelf: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Bukhari",
  },
});

export default CollegeRecommendations;
