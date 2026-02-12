import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, collection, addDoc } from "firebase/firestore";
import app from "../Configs/firebaseConfig";
import MarkdownDisplay from "react-native-markdown-display"; // Import the library

const auth = getAuth(app);
const firestore = getFirestore(app);

const GeneratedEssays = ({ route }) => {
  const navigation = useNavigation();
  const responseText = route.params?.responseText || "";
  const [savedEssays, setSavedEssays] = useState(new Set());

  if (!responseText) {
    // Error state UI remains the same
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollView}>
          <Text style={styles.header}>Essay Ideas</Text>
          <Text style={styles.errorMessage}>
            Oops! Something went wrong. Please try generating ideas again.
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate("EssayGenerator")}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate("Home")}
            >
              <Text style={styles.buttonText}>Return Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const sections = responseText.split(/\n\n+/);

  const saveEssay = async (currentIndex) => {
    // This logic remains unchanged as it works on the raw text
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "User is not authenticated");
        return;
      }
      let nextTitleIndex = sections.findIndex(
        (section, idx) => idx > currentIndex && isTitleSection(section)
      );
      if (nextTitleIndex === -1) {
        nextTitleIndex = sections.length;
      }
      const currentSection = sections[currentIndex];
      const essayContent = sections
        .slice(currentIndex + 1, nextTitleIndex)
        .join("\n\n");
      const titleMatch = currentSection.match(/Title:\s*([^\n]+)/);
      const title = titleMatch ? titleMatch[1].trim() : "Untitled Essay";
      const { uid } = user;
      const userDocRef = doc(firestore, "users", uid);
      await addDoc(collection(userDocRef, "essays"), {
        title,
        idea: essayContent,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSavedEssays((prev) => new Set([...prev, currentSection]));
    } catch (error) {
      console.error("Error saving essay:", error);
      Alert.alert("Error", "Failed to save essay");
    }
  };

  const isTitleSection = (text) => {
    return text.includes("Essay Idea #") || text.includes("Title:");
  };

  // Define styles for markdown elements
  const markdownStyles = {
    // For regular text
    body: {
      fontSize: 16,
      color: "#E0E0E0",
      fontFamily: "DMSans",
      lineHeight: 24,
    },
    // For **bolded** text
    strong: {
      fontFamily: "Staat",
      fontSize: 18,
      color: "#fff",
    },
    // For title sections, we'll override the 'body' style
    titleBody: {
      fontSize: 18,
      color: "#FFFFFF",
      fontFamily: "Poppins",
      fontWeight: "bold",
    },
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        <Text style={styles.header}>Essay Ideas from Neil</Text>

        <Image
          source={require("../assets/AI_Writer.png")}
          style={styles.hiThere}
        />
        <Text style={styles.subheader}>
          Generated with Advanced AI.{"\n"}Click the + to add the idea to your
          "My Essays" page.
        </Text>

        {sections.map((section, index) => {
          if (section.trim() === "") return null;

          const isEssaySaved = savedEssays.has(section);
          const isTitleSect = isTitleSection(section);

          return (
            <View
              key={index}
              style={[
                styles.paragraphContainer,
                isTitleSect && styles.titleContainer,
              ]}
            >
              <View style={styles.contentRow}>
                <View style={styles.markdownContent}>
                  <MarkdownDisplay
                    style={{
                      // Use default styles for all elements
                      ...markdownStyles,
                      // If it's a title section, override the 'body' style
                      body: isTitleSect
                        ? markdownStyles.titleBody
                        : markdownStyles.body,
                    }}
                  >
                    {section}
                  </MarkdownDisplay>
                </View>

                {isTitleSect && (
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={() => saveEssay(index)}
                    disabled={isEssaySaved}
                  >
                    <Feather
                      name={isEssaySaved ? "check" : "plus"}
                      size={24}
                      color={isEssaySaved ? "#4CAF50" : "#fff"}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("EssayGenerator")}
          >
            <Text style={styles.buttonText}>brainstorm again</Text>
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
    padding: 8,
  },
  paragraphContainer: {
    backgroundColor: "#2F4547",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#507579",
  },
  contentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  // New style to make the markdown content take up available space
  markdownContent: {
    flex: 1,
  },
  titleContainer: {
    backgroundColor: "#436164",
    borderWidth: 2,
    borderColor: "#6A8E93",
  },
  subheader: {
    fontFamily: "Staat",
    fontSize: 18,
    color: "#fff",
    marginVertical: 7,
    textAlign: "center",
    alignSelf: "center",
  },
  saveButton: {
    backgroundColor: "#507579",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#6A8E93",
    alignSelf: "flex-start",
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
    width: 130,
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

export default GeneratedEssays;
