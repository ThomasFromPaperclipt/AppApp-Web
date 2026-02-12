import React from "react";
import {
  View,
  ScrollView,
  Modal,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { Formik } from "formik";
import CheckBox from "expo-checkbox";
import * as Yup from "yup";
import RNPickerSelect from "react-native-picker-select";
import { useFonts } from "expo-font";
import AntDesign from "@expo/vector-icons/AntDesign";
import * as Haptics from "expo-haptics";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, collection, addDoc } from "firebase/firestore";
import app from "../Configs/firebaseConfig";

const auth = getAuth(app);
const firestore = getFirestore(app);
const { height } = Dimensions.get("window");

const ActivityModal = ({ isVisible, onClose, onSuccess }) => {
  const [fontsLoaded] = useFonts({
    Bukhari: require("../assets/fonts/Bukhari Script.ttf"),
    Poppins: require("../assets/fonts/Poppins-Bold.ttf"),
    DMSans: require("../assets/fonts/DMSans.ttf"),
    Staat: require("../assets/fonts/Staatliches.ttf"),
    Abel: require("../assets/fonts/Abel-Regular.ttf"),
  });

  const handleSavePress = (handleSubmit, validateForm) => {
    Haptics.selectionAsync();
    validateForm().then((errors) => {
      if (Object.keys(errors).length > 0) {
        Alert.alert("Error", "Please fill in all required fields.");
      } else {
        Alert.alert("Save Activity", "All done?", [
          { text: "Save and Add Another", onPress: handleSubmit },
          {
            text: "All Done!",
            onPress: () => {
              handleSubmit();
              onClose();
            },
          },
        ]);
      }
    });
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Formik
            initialValues={{
              activityType: "",
              position: "",
              organizationName: "",
              description: "",
              gradeLevels: [],
              participationTiming: [],
              hoursPerWeek: "",
              weeksPerYear: "",
              participateInCollege: "",
            }}
            validationSchema={Yup.object({
              activityType: Yup.string().required("Required"),
              position: Yup.string().required("Required"),
              description: Yup.string().required("Required"),
              hoursPerWeek: Yup.number().required("Required"),
              weeksPerYear: Yup.number().required("Required"),
              participateInCollege: Yup.string().required("Required"),
            })}
            onSubmit={async (values, { resetForm }) => {
              try {
                const user = auth.currentUser;
                if (user) {
                  const { uid } = user;
                  const userDocRef = doc(firestore, "users", uid);
                  const activityData = { ...values };
                  await addDoc(
                    collection(userDocRef, "activities"),
                    activityData
                  );
                  await Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                  );
                  Alert.alert(
                    "Success! 🎉",
                    "Activity Saved. You may need to refresh to see it."
                  );
                  resetForm();
                  if (onSuccess) onSuccess();
                } else {
                  Alert.alert("Error", "There was an error in saving");
                }
              } catch (error) {
                console.error("Error saving activity:", error);
                Alert.alert("Error", "Failed to save activity");
              }
            }}
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              setFieldValue,
              errors,
              touched,
              validateForm,
            }) => (
              <ScrollView
                contentContainerStyle={styles.scrollViewContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.headerContainer}>
                  <Text style={styles.headerText}>Add an Activity</Text>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                  >
                    <AntDesign name="close" size={24} color="black" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.description}>
                  Don't freak out: there are a lot of fields to enter but this
                  is one of the most important sections.
                </Text>

                <Text style={styles.textStyle}>Activity Type</Text>
                <RNPickerSelect
                  onValueChange={(itemValue) =>
                    setFieldValue("activityType", itemValue)
                  }
                  items={[
                    { label: "Academic", value: "academic" },
                    { label: "Art", value: "art" },
                    { label: "Athletics: Club", value: "clubAthlete" },
                    { label: "Athletics: JV or Varsity", value: "athlete" },
                    { label: "Career-Oriented", value: "career" },
                    { label: "Community (Volunteer)", value: "volunteer" },
                    { label: "Tech", value: "tech" },
                    { label: "Cultural", value: "cultural" },
                    { label: "Dance", value: "dance" },
                    { label: "Speech or Debate", value: "speech" },
                    { label: "Environmental", value: "environmental" },
                    { label: "Family Responsibility", value: "family" },
                    { label: "Foreign Exchange", value: "foreign" },
                    { label: "Internship", value: "internship" },
                    { label: "Journalism", value: "journalism" },
                    { label: "Jr. ROTC", value: "rotc" },
                    { label: "LGBT", value: "lgbt" },
                    { label: "Musical (Instrumental)", value: "instrumental" },
                    { label: "Musical (Vocal)", value: "vocal" },
                    { label: "Religious", value: "religious" },
                    { label: "Research", value: "research" },
                    { label: "Robotics", value: "robotics" },
                    { label: "School Spirit", value: "schoolspirit" },
                    { label: "Science/Math", value: "sciencemath" },
                    { label: "Social Justice", value: "justice" },
                    { label: "Student Gov/Politics", value: "politics" },
                    { label: "Theater", value: "theater" },
                    { label: "Work (Paid)", value: "work" },
                    { label: "Other", value: "other" },
                  ]}
                  style={{
                    inputIOS: styles.picker,
                    inputAndroid: styles.picker,
                  }}
                  value={values.activityType}
                  useNativeAndroidPickerStyle={false}
                />

                <Text style={styles.textStyle}>Organization Name</Text>
                <Text style={styles.subDescription}>
                  i.e. "Basketball," "Debate Club," "Theater"
                </Text>
                <TextInput
                  style={styles.input}
                  onChangeText={handleChange("organizationName")}
                  onBlur={handleBlur("organizationName")}
                  value={values.organizationName}
                />

                <Text style={styles.textStyle}>Position (Or Leadership)</Text>
                <Text style={styles.subDescription}>
                  If you don't have a leadership role say "participant."
                </Text>
                <TextInput
                  style={styles.input}
                  onChangeText={handleChange("position")}
                  onBlur={handleBlur("position")}
                  value={values.position}
                />

                <Text style={styles.textStyle}>Description</Text>
                <Text style={styles.subDescription}>
                  Make the most out of this section. If you won any awards in
                  this activity, list them here to save space in the Honors
                  section.
                </Text>
                <TextInput
                  style={[styles.input, { height: 200 }]}
                  onChangeText={handleChange("description")}
                  onBlur={handleBlur("description")}
                  value={values.description}
                  multiline={true}
                />

                <Text style={styles.textStyle}>Participation Grade Levels</Text>
                {[9, 10, 11, 12].map((grade) => (
                  <View key={grade} style={styles.checkboxContainer}>
                    <CheckBox
                      value={values.gradeLevels.includes(grade)}
                      onValueChange={() => {
                        const newGradeLevels = values.gradeLevels.includes(
                          grade
                        )
                          ? values.gradeLevels.filter((g) => g !== grade)
                          : [...values.gradeLevels, grade];
                        setFieldValue("gradeLevels", newGradeLevels);
                      }}
                    />
                    <Text style={styles.checkBoxText}>{grade}</Text>
                  </View>
                ))}

                <Text style={styles.textStyle}>Timing of Participation</Text>
                {["During school year", "During school break", "All year"].map(
                  (timing) => (
                    <View key={timing} style={styles.checkboxContainer}>
                      <CheckBox
                        value={values.participationTiming.includes(timing)}
                        onValueChange={() => {
                          const newParticipationTiming =
                            values.participationTiming.includes(timing)
                              ? values.participationTiming.filter(
                                  (t) => t !== timing
                                )
                              : [...values.participationTiming, timing];
                          setFieldValue(
                            "participationTiming",
                            newParticipationTiming
                          );
                        }}
                      />
                      <Text style={styles.checkBoxText}>{timing}</Text>
                    </View>
                  )
                )}

                <Text style={styles.textStyle}>Hours Spent Per Week</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={handleChange("hoursPerWeek")}
                  onBlur={handleBlur("hoursPerWeek")}
                  value={values.hoursPerWeek}
                  keyboardType="numeric"
                />

                <Text style={styles.textStyle}>Weeks Spent Per Year</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={handleChange("weeksPerYear")}
                  onBlur={handleBlur("weeksPerYear")}
                  value={values.weeksPerYear}
                  keyboardType="numeric"
                />

                <Text style={styles.textStyle}>
                  I Intend to Participate in a Similar Activity in College
                </Text>
                <RNPickerSelect
                  onValueChange={(itemValue) =>
                    setFieldValue("participateInCollege", itemValue)
                  }
                  items={[
                    { label: "Yes", value: "yes" },
                    { label: "No", value: "no" },
                  ]}
                  style={{
                    inputIOS: styles.picker,
                    inputAndroid: styles.picker,
                  }}
                  value={values.participateInCollege}
                  useNativeAndroidPickerStyle={false}
                />

                <TouchableOpacity
                  onPress={() => handleSavePress(handleSubmit, validateForm)}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Formik>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#BCE6E8",
    height: height * 0.95,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  headerText: {
    fontSize: 24,
    fontFamily: "Poppins",
  },
  closeButton: {
    padding: 10,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  textStyle: {
    fontSize: 16,
    fontFamily: "Poppins",
    marginTop: 15,
  },
  input: {
    height: 40,
    borderColor: "black",
    borderWidth: 1.2,
    borderRadius: 10,
    paddingLeft: 10,
    marginTop: 5,
    fontSize: 16,
  },
  picker: {
    height: 40,
    borderColor: "black",
    borderWidth: 1.2,
    borderRadius: 10,
    paddingLeft: 10,
    marginTop: 5,
    fontSize: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  checkBoxText: {
    marginLeft: 10,
    fontSize: 16,
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  buttonText: {
    fontFamily: "Bukhari",
    fontSize: 18,
    color: "#fff",
  },
  description: {
    fontSize: 14,
    marginBottom: 10,
    marginTop: -5,
    paddingHorizontal: 5,
  },
  subDescription: {
    fontSize: 12,
    marginBottom: 1,
    marginTop: 1,
    paddingHorizontal: 5,
  },
});

export default ActivityModal;
