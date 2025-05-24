import face_recognition
import os
import cv2
import numpy as np
import math
from keras.models import load_model
from keras.preprocessing.image import img_to_array

def face_confidence(face_distance, face_match_threshold=0.6):
    range = (1.0 - face_match_threshold)
    linear_val = (1.0 - face_distance) / (range * 2.0)

    if face_distance > face_match_threshold:
        return str(round(linear_val * 100)) + '%'
    else:
        value = (linear_val + ((1.0 - linear_val) * math.pow((linear_val - 0.5) * 2, 0.2))) * 100
        return str(round(value, 2)) + '%'

class FaceRecognition:
    def __init__(self):
        self.face_locations = []
        self.face_encodings = []
        self.face_names = []
        self.known_face_encodings = []
        self.known_face_names = []
        self.process_current_frame = True
        
        try:
            self.liveness_model = load_model('liveness.model')
            print("Liveness model loaded successfully")
        except Exception as e:
            print(f"Error loading liveness model: {e}")
            self.liveness_model = None
        
        self.encode_faces()

    def encode_faces(self):
        for image in os.listdir('uploads'):
            try:
                face_image = face_recognition.load_image_file(f'uploads/{image}')
                face_encodings = face_recognition.face_encodings(face_image)
                if face_encodings:
                    self.known_face_encodings.append(face_encodings[0])
                    self.known_face_names.append(os.path.splitext(image)[0])
                else:
                    print(f"No face found in image: {image}")
            except Exception as e:
                print(f"Error processing image {image}: {e}")

    def check_liveness(self, frame, face_location):
        if self.liveness_model is None:
            return True  # Skip liveness check if no model
            
        top, right, bottom, left = face_location
        face = frame[top:bottom, left:right]
        
        try:
            face = cv2.resize(face, (64, 64))
            face = img_to_array(face)
            face = np.expand_dims(face, axis=0)
            face = face.astype("float") / 255.0
            preds = self.liveness_model.predict(face)[0]
            return np.argmax(preds) == 1  # Returns True if real, False if fake
        except Exception as e:
            print(f"Liveness detection error: {e}")
            return False

    def run_recognition(self, input_username):
        video_capture = cv2.VideoCapture(0)
        if not video_capture.isOpened():
            raise Exception("Video source not found")

        detected = False
        frame_count = 0

        while True:
            ret, frame = video_capture.read()
            if not ret:
                break

            # Only process every other frame to improve performance
            if frame_count % 2 == 0:
                small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
                rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
                
                # Find all face locations and encodings
                self.face_locations = face_recognition.face_locations(rgb_small_frame)
                self.face_encodings = face_recognition.face_encodings(rgb_small_frame, self.face_locations)
                self.face_names = []

                for face_encoding, (top, right, bottom, left) in zip(self.face_encodings, self.face_locations):
                    # Scale face locations back up
                    top *= 4
                    right *= 4
                    bottom *= 4
                    left *= 4
                    
                    # Compare faces
                    matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding)
                    name = "Unknown"
                    confidence = "Unknown"

                    face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
                    best_match_index = np.argmin(face_distances)

                    if matches[best_match_index]:
                        name = self.known_face_names[best_match_index]
                        confidence = face_confidence(face_distances[best_match_index])

                        confidence_value = float(confidence.strip('%')) if confidence != "Unknown" else 0.0
                        if name == input_username and confidence_value > 80:
                            if self.check_liveness(frame, (top, right, bottom, left)):
                                detected = True
                                self.face_names.append(f'{name} ({confidence}) [LIVE]')
                            else:
                                self.face_names.append(f'{name} ({confidence}) [FAKE]')
                        else:
                            self.face_names.append(f'{name} ({confidence})')
                    else:
                        self.face_names.append(name)

            frame_count += 1

            # Display results
            for (top, right, bottom, left), name in zip([(t*4, r*4, b*4, l*4) for (t, r, b, l) in self.face_locations], self.face_names):
                # Draw boxes and labels
                color = (0, 255, 0) if "Unknown" not in name else (0, 0, 255)
                cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
                cv2.rectangle(frame, (left, bottom - 35), (right, bottom), color, -1)
                cv2.putText(frame, name, (left + 6, bottom - 6), cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 1)

            cv2.imshow('Face Recognition', frame)

            if detected:
                break

            if cv2.waitKey(1) == ord('q'):
                break

        video_capture.release()
        cv2.destroyAllWindows()
        return detected