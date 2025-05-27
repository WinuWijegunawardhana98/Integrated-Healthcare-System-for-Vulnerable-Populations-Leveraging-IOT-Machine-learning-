import React, { useState, useEffect } from 'react';
import ENV from '../data/Env';
import axios from 'axios';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const PersonalPredictions = ({ bpm, beatAvg, degreeC, ecg, spo2, lat, lng, onRiskChange }) => {
  const [risk, setRisk] = useState(null);
  const [riskPercentage, setRiskPercentage] = useState(0);
  const [previousRisks, setPreviousRisks] = useState([]);
  const [message, setMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [userLocation, setUserLocation] = useState({ lat: Number(lat) || 6.9271, lng: Number(lng) || 79.8612 });
  const [icon, setIcon] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [healthData, setHealthData] = useState(null);

  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : {};
  });

  useEffect(() => {
    if (!user.contact) {
      console.warn("User data is not available or invalid.");
    }
  }, [user]);

  useEffect(() => {
      const fetchUserData = async () => {
        try {
          const response = await axios.get(`${ENV.SERVER}/users/${user.username}/all`);
          setUserData(response.data.user);
          setHealthData(response.data.personal_health);
        } catch (err) {
          console.error('Error fetching user health data:', err);
        } 
      };
      fetchUserData();
    }, [user]);

    const sendMessage = async (mobile, riskStatus) => {
    try {
      // Create Google Maps shareable link
      const mapsLink = `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
      
      // Prepare the message with all critical information
      const message = `URGENT: Heart Risk Alert\n\n` +
        `Risk Status: ${riskStatus}\n` +
        `Risk Confidence: ${riskPercentage}%\n\n` +
        `Current Vital Signs:\n` +
        `- Heart Rate: ${bpm} BPM\n` +
        `- Oxygen Level: ${spo2}%\n` +
        `- Body Temp: ${degreeC}°C\n\n` +
        `Patient Location:\n${mapsLink}\n\n` +
        `User Info:\n` +
        `- Name: ${userData?.name || 'N/A'}\n` +
        `- Age: ${healthData?.age || 'N/A'}\n` +
        `- Medical Conditions: ${healthData?.conditions?.join(', ') || 'None reported'}\n\n` +
        `Please respond immediately.`;
      
      // URL encode the message
      const encodedMessage = encodeURIComponent(message);
      
      await fetch(
        `https://app.notify.lk/api/v1/send?user_id=29106&api_key=dOrAUpqYTxOQJBtQjcsN&sender_id=NotifyDEMO&to=+94${mobile.substring(1)}&message=${encodedMessage}`
      ).then((response) => {
        console.log('Emergency message sent:', response);
      });
    } catch (error) {
      console.error('Error sending emergency message:', error); 
    }
  };

  useEffect(() => {
    const fetchRiskData = async () => {
      try {
        const riskResponse = await axios.post(ENV.SERVER + '/predict-heart-heart-risk2', {
          age: healthData?.age || 20,
          bmi: healthData?.bmi || 20,
          resting_bp: bpm || 120,
          spo2: spo2 || 98,
          ecg: ecg || 0
        });

        const detailedResponse = await axios.post(ENV.SERVER + '/predict-heart-heart-risk3', {
          age: healthData?.age || 45,
          sex: healthData?.gender === 'Female' ? 0 : 1 || 1,
          cp: 0,
          trestbps: bpm || 120,
          chol: healthData?.cholesterol || 200,
          fbs: healthData?.diabetes ? 1 : 0 || 0,
          restecg: ecg || 0,
          thalach: healthData?.max_bpm || 150,
          exang: 0,
          oldpeak: 0.0,
          slope: 1,
          ca: 0,
          thal: 2
        });

        const existingRisk = riskResponse.data?.heart_attack_risk;
        const existingConfidence = riskResponse.data?.confidence_rate || 70;
        const detailedPrediction = detailedResponse.data?.prediction;
        const existingRiskBinary = existingRisk === 'High' ? 1 : 0;

        let finalRisk;
        let finalConfidence;

        if (existingRiskBinary === detailedPrediction) {
          finalRisk = existingRisk;
          finalConfidence = Math.min(existingConfidence + 15, 95);
        } else {
          finalRisk = existingRisk;
          finalConfidence = Math.max(existingConfidence - 20, 30);
        }

        setRisk(finalRisk);
        setRiskPercentage(finalConfidence);
        onRiskChange?.(finalRisk);

        setPreviousRisks((prevRisks) => {
          const updatedRisks = [...prevRisks, finalRisk];
          return updatedRisks.length > 5 ? updatedRisks.slice(1) : updatedRisks;
        });

      } catch (error) {
        console.error("Error fetching risk data:", error);
        try {
          const fallbackResponse = await axios.post(ENV.SERVER + '/predict-heart-heart-risk2', {
            age: healthData?.age || 20,
            bmi: healthData?.bmi || 20,
            resting_bp: bpm || 120,
            spo2: spo2 || 98,
            ecg: ecg || 0
          });

          if (fallbackResponse.data) {
            setRisk(fallbackResponse.data.heart_attack_risk);
            setRiskPercentage(fallbackResponse.data.confidence_rate);
            onRiskChange?.(fallbackResponse.data.heart_attack_risk);
          } else {
            onRiskChange?.(null);
          }
        } catch (fallbackError) {
          console.error("Fallback API also failed:", fallbackError);
          onRiskChange?.(null);
        }
      }
    };

    const intervalId = setInterval(fetchRiskData, 5000); 
    return () => clearInterval(intervalId);
  }, [bpm, healthData]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (lat && lng) {
      setUserLocation({ lat: Number(lat), lng: Number(lng) });
    }
  }, [lat, lng]);

  useEffect(() => {
    if (previousRisks.length >= 5) {
      if (previousRisks.every(risk => risk === previousRisks[0])) {
        setMessage('The risk value remains consistent. Please check if the device is properly connected.');
      }

      if (previousRisks.every((val, index) => index === 0 || val > previousRisks[index - 1])) {
        setWarningMessage('Risk value is continuously increasing. Please calm down or take appropriate measures.');
      }
    }

    if (riskPercentage > 80) {
      setWarningMessage(prev => prev + ' Please contact a health professional immediately.');
    }
  }, [previousRisks, riskPercentage]);

  useEffect(() => {
    if (window.google) {
      setIcon({
        url: "https://play-lh.googleusercontent.com/5WifOWRs00-sCNxCvFNJ22d4xg_NQkAODjmOKuCQqe57SjmDw8S6VOSLkqo6fs4zqis",
        scaledSize: new window.google.maps.Size(40, 40),
      });
    }
  }, [risk]);

  return (
    <div className="recentCustomers">
      <div className="cardHeader">
        <h2>Prediction Summary</h2>
      </div>
      <br /><br />
      <div className="predictionCard" style={{textAlign: 'center'}}>
        <div className="speedometer">
          <svg width="200" height="120" viewBox="0 0 200 120">
            <path
              d="M10,110 A90,90 0 0,1 190,110"
              stroke="#ddd"
              strokeWidth="15"
              fill="none"
            />
            <path
              d="M10,110 A90,90 0 0,1 190,110"
              stroke={
                riskPercentage > 80 ? "#e74c3c" : riskPercentage > 50 ? "#f39c12" : "#2ecc71"
              }
              strokeWidth="15"
              fill="none"
              strokeDasharray="180"
              strokeDashoffset={180 - (180 * riskPercentage) / 100}
              className="gauge"
            />
            <line
              x1="100"
              y1="110"
              x2={100 + 80 * Math.cos((Math.PI * (riskPercentage - 50)) / 100)}
              y2={110 - 80 * Math.sin((Math.PI * (riskPercentage - 50)) / 100)}
              stroke="red"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="100" cy="110" r="8" fill="black" />
          </svg>
        </div>
        {risk !== "Not Risk" && <span style={{ fontSize: '4em', fontWeight: 'bold', color: riskPercentage > 80 ? 'red' : 'black' }}>{riskPercentage}%</span>}
        {risk !== null && <h3>{risk}</h3>}
        <br />
        {message && <p style={{ color: '#f39c12', fontWeight: 'bold' }}>{message}</p>}
        {warningMessage && <p style={{ color: '#e74c3c', fontWeight: 'bold' }}>{warningMessage}</p>}
      </div>

      <div style={{ borderRadius: '10px', overflow: 'hidden', width: '100%', height: '250px', margin: '10px' }}>
        {loading && (
          <LoadScript googleMapsApiKey="AIzaSyDTJjnuqF0J18Uu_Ft2TA5R13WsyyDbo4U">
            <GoogleMap
              mapContainerStyle={{ height: '250px' }}
              center={userLocation}
              zoom={15}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false
              }}
            >
              {icon && <Marker position={userLocation} icon={icon} />}
            </GoogleMap>
          </LoadScript>
        )}
      </div>

      {user?.contact && (
        <button 
          onClick={() => sendMessage(user.contact, risk)}
          style={{
            width: '100%', 
            backgroundColor: 'red', 
            color: 'white', 
            padding: '10px', 
            margin: '10px 0', 
            border: 'none', 
            borderRadius: '5px', 
            cursor: 'pointer'
          }}
        >
          Send Emergency Message
        </button>
      )}
    </div>
  );
};

export default PersonalPredictions;