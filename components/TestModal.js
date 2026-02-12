import React, { useState } from "react";
import {
  View,
  ScrollView,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  Linking,
} from "react-native";
import { Formik } from "formik";
import RNPickerSelect from "react-native-picker-select";
import * as Yup from "yup";
import { useFonts } from "expo-font";
import AntDesign from "@expo/vector-icons/AntDesign";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, collection, addDoc } from "firebase/firestore";
import app from "../Configs/firebaseConfig";

const auth = getAuth(app);
const firestore = getFirestore(app);
const { height } = Dimensions.get("window");

const formatDateToMMDDYYYY = (date) => {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
};

const handleAPPress = () => {
  Linking.openURL(
    "https://apstudents.collegeboard.org/ap-exams-what-to-know/past-exam-dates"
  );
};

const TestModal = ({ isVisible, onClose }) => {
  const [fontsLoaded] = useFonts({
    Bukhari: require("../assets/fonts/Bukhari Script.ttf"),
    Poppins: require("../assets/fonts/Poppins-Bold.ttf"),
    DMSans: require("../assets/fonts/DMSans.ttf"),
    Staat: require("../assets/fonts/Staatliches.ttf"),
    Abel: require("../assets/fonts/Abel-Regular.ttf"),
  });

  const [showDatePicker, setShowDatePicker] = useState(false);

  if (!fontsLoaded) {
    return null;
  }

  const handleSavePress = (handleSubmit, validateForm) => {
    Haptics.selectionAsync();
    validateForm().then((errors) => {
      if (Object.keys(errors).length > 0) {
        Alert.alert("Error", "Please fill in all required fields.");
      } else {
        Alert.alert("Save Test Score", "All done?", [
          { text: "Save and Add Another", onPress: handleSubmit },
          {
            text: "All Done!",
            onPress: () => {
              handleSubmit();
              Haptics.notificationAsync();
              Alert.alert(
                "Success! 🎉",
                "Test saved successfully. You may need to refresh to see it."
              );
              onClose();
            },
          },
        ]);
      }
    });
  };

  const getValidationSchema = (testType) => {
    return Yup.object().shape({
      testType: Yup.string().required("Required"),
      apTest:
        testType === "AP"
          ? Yup.string().required("Required")
          : Yup.string().notRequired(),
      score: Yup.number()
        .required("Required")
        .test("isValidScore", "Invalid score", function (value) {
          if (testType === "SAT") return value >= 400 && value <= 1600;
          if (testType === "AP") return value >= 1 && value <= 5;
          if (testType === "ACT") return value >= 1 && value <= 36;
          if (testType === "PSAT 8/9") return value >= 240 && value <= 1440;
          if (testType === "PSAT/NMSQT") return value >= 320 && value <= 1520;
          return false;
        }),
    });
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
          >
            <Formik
              initialValues={{
                testType: "",
                apTest: "",
                score: "",
                testDate: new Date(),
              }}
              validate={(values) => {
                const schema = getValidationSchema(values.testType);
                try {
                  schema.validateSync(values, { abortEarly: false });
                } catch (errors) {
                  return errors.inner.reduce((acc, error) => {
                    acc[error.path] = error.message;
                    return acc;
                  }, {});
                }
                return {};
              }}
              onSubmit={async (values, { resetForm }) => {
                try {
                  const user = auth.currentUser;
                  if (user) {
                    const { uid } = user;
                    const userDocRef = doc(firestore, "users", uid);
                    const testScoreData = {
                      type: values.testType,
                      apTest: values.testType === "AP" ? values.apTest : null,
                      score: values.score,
                      date: formatDateToMMDDYYYY(values.testDate),
                    };
                    await addDoc(
                      collection(userDocRef, "tests"),
                      testScoreData
                    );
                    resetForm();
                  } else {
                    Alert.alert("Error", "User is not authenticated");
                  }
                } catch (error) {
                  console.error("Error saving test score:", error);
                  Alert.alert("Error", "Failed to save test score");
                }
              }}
            >
              {({
                handleChange,
                handleBlur,
                handleSubmit,
                setFieldValue,
                values,
                errors,
                touched,
                validateForm,
              }) => (
                <ScrollView
                  contentContainerStyle={styles.scrollViewContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.headerContainer}>
                    <Text style={styles.headerText}>Add Test Score</Text>
                    <TouchableOpacity
                      onPress={onClose}
                      style={styles.closeButton}
                    >
                      <AntDesign name="close" size={24} color="black" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.description}>
                    You will be responsible for self-reporting any standardized
                    tests you took, including AP, SAT, and ACT scores. You can
                    also save PSAT scores here, although generally these aren't
                    submitted.
                  </Text>

                  <Text style={styles.textStyle}>Test Type</Text>
                  <RNPickerSelect
                    onValueChange={(itemValue) =>
                      setFieldValue("testType", itemValue)
                    }
                    items={[
                      { label: "AP Test", value: "AP" },
                      { label: "SAT", value: "SAT" },
                      { label: "PSAT 8/9", value: "PSAT 8/9" },
                      { label: "PSAT/NMSQT", value: "PSAT/NMSQT" },
                      { label: "ACT", value: "ACT" },
                    ]}
                    style={{
                      inputIOS: styles.picker,
                      inputAndroid: styles.picker,
                    }}
                    value={values.testType}
                    useNativeAndroidPickerStyle={false}
                  />
                  {touched.testType && errors.testType && (
                    <Text style={styles.errorText}>{errors.testType}</Text>
                  )}

                  {values.testType === "AP" && (
                    <>
                      <Text style={styles.textStyle}>AP Test</Text>
                      <RNPickerSelect
                        onValueChange={(itemValue) =>
                          setFieldValue("apTest", itemValue)
                        }
                        items={[
                          { label: "AP Art History", value: "AP Art History" },
                          { label: "AP Biology", value: "AP Biology" },
                          { label: "AP Calculus AB", value: "AP Calculus AB" },
                          { label: "AP Calculus BC", value: "AP Calculus BC" },
                          { label: "AP Chemistry", value: "AP Chemistry" },
                          {
                            label: "AP Chinese Language & Culture",
                            value: "AP Chinese Language & Culture",
                          },
                          {
                            label: "AP Comparative Government & Politics",
                            value: "AP Comparative Government & Politics",
                          },
                          {
                            label: "AP Computer Science A",
                            value: "AP Computer Science A",
                          },
                          {
                            label: "AP Computer Science Principles",
                            value: "AP Computer Science Principles",
                          },
                          {
                            label: "AP English Language and Composition",
                            value: "AP English Language and Composition",
                          },
                          {
                            label: "AP English Literature and Composition",
                            value: "AP English Literature and Composition",
                          },
                          {
                            label: "AP Environmental Science",
                            value: "AP Environmental Science",
                          },
                          {
                            label: "AP European History",
                            value: "AP European History",
                          },
                          {
                            label: "AP French Language & Culture",
                            value: "AP French Language & Culture",
                          },
                          {
                            label: "AP German Language & Culture",
                            value: "AP German Language & Culture",
                          },
                          {
                            label: "AP Human Geography",
                            value: "AP Human Geography",
                          },
                          {
                            label: "AP Italian Language & Culture",
                            value: "AP Italian Language & Culture",
                          },
                          {
                            label: "AP Japanese Language and Culture",
                            value: "AP Japanese Language and Culture",
                          },
                          { label: "AP Latin", value: "AP Latin" },
                          {
                            label: "AP Macroeconomics",
                            value: "AP Macroeconomics",
                          },
                          {
                            label: "AP Microeconomics",
                            value: "AP Microeconomics",
                          },
                          {
                            label: "AP Music Theory",
                            value: "AP Music Theory",
                          },
                          {
                            label: "AP Physics 1: Algebra-Based",
                            value: "AP Physics 1: Algebra-Based",
                          },
                          {
                            label: "AP Physics 2: Algebra-Based",
                            value: "AP Physics 2: Algebra-Based",
                          },
                          {
                            label: "AP Physics C: Electricity & Magnetism",
                            value: "AP Physics C: Electricity & Magnetism",
                          },
                          {
                            label: "AP Physics C: Mechanics",
                            value: "AP Physics C: Mechanics",
                          },
                          { label: "AP Psychology", value: "AP Psychology" },
                          { label: "AP Research", value: "AP Research" },
                          { label: "AP Seminar", value: "AP Seminar" },
                          {
                            label: "AP Spanish Language & Culture",
                            value: "AP Spanish Language & Culture",
                          },
                          {
                            label: "AP Spanish Literature & Culture",
                            value: "AP Spanish Literature & Culture",
                          },
                          { label: "AP Statistics", value: "AP Statistics" },
                          {
                            label: "AP Studio Art: 2-D Design",
                            value: "AP Studio Art: 2-D Design",
                          },
                          {
                            label: "AP Studio Art: 3-D Design",
                            value: "AP Studio Art: 3-D Design",
                          },
                          {
                            label: "AP Studio Art: Drawing",
                            value: "AP Studio Art: Drawing",
                          },
                          {
                            label: "AP U.S. Government & Politics",
                            value: "AP U.S. Government & Politics",
                          },
                          {
                            label: "AP U.S. History",
                            value: "AP U.S. History",
                          },
                          {
                            label: "AP World History",
                            value: "AP World History",
                          },
                        ]}
                        style={{
                          inputIOS: styles.picker,
                          inputAndroid: styles.picker,
                        }}
                        value={values.apTest}
                        useNativeAndroidPickerStyle={false}
                      />
                      {touched.apTest && errors.apTest && (
                        <Text style={styles.errorText}>{errors.apTest}</Text>
                      )}
                    </>
                  )}

                  <Text style={styles.textStyle}>Score</Text>
                  <TextInput
                    style={styles.input}
                    onChangeText={handleChange("score")}
                    onBlur={handleBlur("score")}
                    value={values.score}
                    keyboardType="numeric"
                  />
                  {touched.score && errors.score && (
                    <Text style={styles.errorText}>{errors.score}</Text>
                  )}

                  <Text style={styles.textStyle}>Test Date</Text>
                  <Text style={styles.subDescription}>
                    This is optional but highly recommended since the Common App
                    will ask for it.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={styles.input}
                  >
                    <Text style={styles.dateText}>
                      {values.testDate.toDateString()}
                    </Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={values.testDate}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                          setFieldValue("testDate", selectedDate);
                        }
                      }}
                    />
                  )}
                  <TouchableOpacity onPress={handleAPPress}>
                    <Text style={styles.textButton}>
                      View Past AP Exam Dates Here
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => handleSavePress(handleSubmit, validateForm)}
                  >
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </Formik>
          </KeyboardAvoidingView>
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
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 30,
    paddingBottom: 100,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerText: {
    fontSize: 24,
    fontFamily: "Poppins",
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    fontSize: 24,
    fontFamily: "Poppins",
  },
  textStyle: {
    fontFamily: "Poppins",
    fontSize: 16, // Increase the font size
    marginBottom: 10, // Add more space around text
    marginTop: 15,
  },
  picker: {
    fontSize: 17, // Increase the font size
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1.2,
    borderColor: "#000",
    borderRadius: 4,
    color: "black",
    paddingRight: 30, // To ensure the text is not cut off
    borderRadius: 10,
  },
  input: {
    borderWidth: 1.2,
    borderColor: "#000",
    padding: 15, // Add more padding
    marginBottom: 20, // Add more space around input fields
    borderRadius: 10,
    fontSize: 17,
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginTop: 30,
    marginBottom: 30,
    alignSelf: "center",
  },
  buttonText: {
    fontFamily: "Bukhari",
    fontSize: 18,
    color: "#fff",
  },
  errorText: {
    fontSize: 14,
    color: "red",
    marginBottom: 10,
  },
  dateText: {
    fontSize: 17,
    color: "black",
  },
  description: {
    //fontFamily: "Poppins",
    fontSize: 15, // Increase the font size
    marginBottom: 10, // Add more space around text
    marginTop: -10,
    paddingHorizontal: 5,
  },
  subDescription: {
    //fontFamily: "Poppins",
    fontSize: 15, // Increase the font size
    marginBottom: 10, // Add more space around text
    marginTop: -10,
    paddingHorizontal: 5,
  },
  textButton: {
    fontSize: 14,
    marginBottom: 20,
    alignSelf: "center",
    textDecorationLine: "underline",
  },
});

export default TestModal;
