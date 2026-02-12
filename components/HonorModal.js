import React, { useState } from "react";
import {
  View,
  ScrollView,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { Formik } from "formik";
import * as Yup from "yup";
import { useFonts } from "expo-font";
import AntDesign from "@expo/vector-icons/AntDesign";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, collection, addDoc } from "firebase/firestore";
import * as Haptics from "expo-haptics";
import RNPickerSelect from "react-native-picker-select";
import Modal from "react-native-modal";

const SCREEN_HEIGHT = Dimensions.get("window").height;

// Helper function to format date
const formatDateToMMDDYYYY = (date) => {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
};

const HonorModal = ({ isVisible, onClose, onSuccess }) => {
  const [fontsLoaded] = useFonts({
    Bukhari: require("../assets/fonts/Bukhari Script.ttf"),
    Poppins: require("../assets/fonts/Poppins-Bold.ttf"),
    DMSans: require("../assets/fonts/DMSans.ttf"),
    Staat: require("../assets/fonts/Staatliches.ttf"),
  });

  const [showDatePicker, setShowDatePicker] = useState(false);

  const auth = getAuth();
  const firestore = getFirestore();
  const user = auth.currentUser;

  if (!fontsLoaded) {
    return null;
  }

  const handleSavePress = (handleSubmit, validateForm) => {
    validateForm().then((errors) => {
      if (Object.keys(errors).length > 0) {
        Alert.alert("Error", "Please fill in all required fields.");
      } else {
        Alert.alert("Save Honor", "All done?", [
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

  const handleDateChange = (event, selectedDate, setFieldValue) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFieldValue("date", formatDateToMMDDYYYY(selectedDate));
    }
  };

  const saveToFirestore = async (values, resetForm) => {
    try {
      const honorData = {
        honorTitle: values.honorTitle,
        honorType: values.honorType,
        date: values.date,
        description: values.description,
        createdAt: new Date().toISOString(),
      };

      const userDocRef = doc(firestore, "users", user.uid);
      const honorsCollectionRef = collection(userDocRef, "honors");

      await addDoc(honorsCollectionRef, honorData);
      Haptics.notificationAsync();
      Alert.alert(
        "Success 🎉",
        "Honor saved successfully! You may need to refresh to see it"
      );
      resetForm();
      if (onSuccess) onSuccess();
    } catch (error) {
      Alert.alert("Error", "Failed to save honor. Please try again.");
      console.error("Error saving honor:", error);
    }
  };

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      onBackdropPress={onClose}
      style={styles.modal}
      propagateSwipe
      avoidKeyboard
    >
      <View style={styles.modalContent}>
        <View style={styles.modalHandle} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <Formik
            initialValues={{
              honorTitle: "",
              honorType: "",
              date: "",
              description: "",
            }}
            validationSchema={Yup.object({
              honorTitle: Yup.string().required("Required"),
              date: Yup.date().required("Required"),
            })}
            onSubmit={(values, { resetForm }) => {
              saveToFirestore(values, resetForm);
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
                  <Text style={styles.headerText}>Add an Honor</Text>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                  >
                    <AntDesign name="close" size={30} color="black" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.description}>
                  Honors are awards, prizes, etc. On the Common App, you can
                  only list 5 honors and will not be able to describe them, but
                  it's a good idea to save all of them here so you can pick your
                  strongest ones later.
                </Text>

                <Text style={styles.textStyle}>Honor Title</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={handleChange("honorTitle")}
                  onBlur={handleBlur("honorTitle")}
                  value={values.honorTitle}
                />
                {touched.honorTitle && errors.honorTitle && (
                  <Text style={styles.errorText}>{errors.honorTitle}</Text>
                )}

                <Text style={styles.textStyle}>Honor Type</Text>
                <RNPickerSelect
                  onValueChange={(itemValue) =>
                    setFieldValue("honorType", itemValue)
                  }
                  items={[
                    { label: "School", value: "school" },
                    { label: "State/Regional", value: "state" },
                    { label: "National", value: "national" },
                    { label: "International", value: "international" },
                  ]}
                  style={{
                    inputIOS: styles.picker,
                    inputAndroid: styles.picker,
                  }}
                  value={values.honorType}
                  useNativeAndroidPickerStyle={false}
                />

                <Text style={styles.textStyle}>Date</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={styles.input}
                >
                  <Text style={styles.dateText}>
                    {values.date || "Select Date"}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) =>
                      handleDateChange(event, selectedDate, setFieldValue)
                    }
                  />
                )}
                {touched.date && errors.date && (
                  <Text style={styles.errorText}>{errors.date}</Text>
                )}

                <Text style={styles.textStyle}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  onChangeText={handleChange("description")}
                  onBlur={handleBlur("description")}
                  value={values.description}
                  multiline={true}
                />

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
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#BCE6E8",
    height: SCREEN_HEIGHT * 0.95,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHandle: {},
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
    fontSize: 30,
    fontFamily: "Poppins",
  },
  closeButton: {
    padding: 10,
  },
  description: {
    fontSize: 16,
    marginBottom: 10,
    marginTop: -10,
    paddingHorizontal: 5,
  },
  textStyle: {
    fontFamily: "Poppins",
    fontSize: 18,
    marginBottom: 10,
    marginTop: 10,
  },
  input: {
    borderWidth: 1.2,
    borderColor: "#000",
    padding: 15,
    marginBottom: 20,
    borderRadius: 10,
    fontSize: 17,
  },
  textArea: {
    height: 150,
    textAlignVertical: "top",
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginTop: 10,
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
  },
  dateText: {
    fontSize: 17,
    color: "black",
  },
  picker: {
    fontSize: 17,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1.2,
    borderColor: "#000",
    borderRadius: 10,
    color: "black",
    paddingRight: 30,
    marginBottom: 20,
  },
});

export default HonorModal;
