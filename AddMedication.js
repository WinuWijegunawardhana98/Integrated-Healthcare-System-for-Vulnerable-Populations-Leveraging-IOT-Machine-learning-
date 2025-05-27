import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import ENV from "../data/Env";

const AddMedication = ({ user }) => {
  const [userData, setUserData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [risk, setRisk] = useState(null);
  const [healthAlerts, setHealthAlerts] = useState([]);
  const [avatar, setAvatar] = useState("/static/sample.png");

  // Medical thresholds
  const MEDICAL_THRESHOLDS = {
    bmi: { healthy: [18.5, 24.9], warning: "BMI outside healthy range (18.5-24.9)" },
    blood_pressure: { 
      healthy: { systolic: [90, 120], diastolic: [60, 80] },
      warning: "Blood pressure outside healthy range (120/80 or lower)"
    },
    cholesterol: {
      healthy: { total: 200 },
      warning: "High cholesterol (above 200 mg/dL)"
    }
  };

  const calculateAge = (dobString) => {
    if (!dobString) return null;
    
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get(`${ENV.SERVER}/users/${user}/all`);
        setUserData(response.data.user);
        
        // Calculate age from DOB
        const personalHealth = response.data.personal_health;
        const age = personalHealth?.dob ? calculateAge(personalHealth.dob) : null;
        
        setHealthData({
          ...personalHealth,
          age: age // Add calculated age
        });
      } catch (err) {
        console.error("Error fetching user health data:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch(ENV.SERVER + `/users/${user}`);
        if (!response.ok) {
          throw new Error("User not found");
        }
        const data = await response.json();
        setAvatar(ENV.SERVER + data.avatar); 
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    if (healthData) {
      // Check for health alerts
      const alerts = [];
      
      // Check BMI
      if (healthData.bmi) {
        const bmi = parseFloat(healthData.bmi);
        if (bmi < MEDICAL_THRESHOLDS.bmi.healthy[0] || bmi > MEDICAL_THRESHOLDS.bmi.healthy[1]) {
          alerts.push({
            field: "bmi",
            value: healthData.bmi,
            message: MEDICAL_THRESHOLDS.bmi.warning
          });
        }
      }
      
      // Check Blood Pressure
      if (healthData.blood_pressure) {
        const [systolic, diastolic] = healthData.blood_pressure.split("/").map(Number);
        if (systolic > MEDICAL_THRESHOLDS.blood_pressure.healthy.systolic[1] || 
            diastolic > MEDICAL_THRESHOLDS.blood_pressure.healthy.diastolic[1]) {
          alerts.push({
            field: "blood_pressure",
            value: healthData.blood_pressure,
            message: MEDICAL_THRESHOLDS.blood_pressure.warning
          });
        }
      }
      
      // Check Cholesterol (assuming total cholesterol)
      if (healthData.cholesterol) {
        const cholesterol = parseInt(healthData.cholesterol);
        if (cholesterol > MEDICAL_THRESHOLDS.cholesterol.healthy.total) {
          alerts.push({
            field: "cholesterol",
            value: healthData.cholesterol,
            message: MEDICAL_THRESHOLDS.cholesterol.warning
          });
        }
      }
      
      setHealthAlerts(alerts);

      // Fetch risk data
      const fetchRiskData = async () => {
        try {
          const response = await axios.post(`${ENV.SERVER}/predict-health-risk`, {
            age: healthData.age || 30,
            gender: healthData.gender || "Male",
            family_history: healthData.heart_diseases || 'No',
            systolic_bp: parseInt(healthData.blood_pressure?.split("/")[0]) || 120,
            diastolic_bp: parseInt(healthData.blood_pressure?.split("/")[1]) || 80,
            heart_rate: 70,
          });
          if (response.data && response.data["Predicted Disease Risk (%)"]) {
            setRisk(response.data["Predicted Disease Risk (%)"]);
          }
        } catch (error) {
          console.error("Error fetching risk data:", error);
        }
      };
      fetchRiskData();
    }
  }, [healthData]);

  const getRiskColor = (risk) => {
    if (risk <= 50) return "#4CAF50"; // green
    if (risk <= 75) return "#FFC107"; // yellow
    return "#F44336"; // red
  };

  const highlightCondition = (value, field) => {
    // Check if value is explicitly true/Yes
    if (value === true || value === "Yes") {
      return { color: "#F44336", fontWeight: "bold" };
    }
    
    // Check if value exceeds medical thresholds
    const hasAlert = healthAlerts.some(alert => alert.field === field);
    if (hasAlert) {
      return { color: "#F44336", fontWeight: "bold" };
    }
    
    // Check if string contains "high"
    if (typeof value === "string" && value.toLowerCase().includes("high")) {
      return { color: "#F44336", fontWeight: "bold" };
    }
    
    return {};
  };

  const links = [
    { name: "All Patients", path: "/logged/patients-section" }, 
    { name: "Patient Profile", path: "/logged/patients-section/patient-profile" },
    { name: "Add New Prescription", path: "/logged/patients-section/add-prescription" },
    { name: "See Schedule", path: "/logged/patients-section/medication-schedule" },
  ];

  return (
    <div className="recentCustomers" style={{ 
      padding: "20px",
    }}>
      <h2 style={{ 
        marginBottom: "25px",
        textAlign: "center",
        color: "#2c3e50",
        fontSize: "24px",
        fontWeight: "600",
        borderBottom: "2px solid #e0e0e0",
        paddingBottom: "10px"
      }}>
        Patient Health Dashboard
      </h2>
      
      {loading && (
        <div style={{ 
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "300px"
        }}>
          <div style={{
            width: "50px",
            height: "50px",
            border: "5px solid #f3f3f3",
            borderTop: "5px solid #3498db",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
        </div>
      )}
      
      {error && <p style={{ color: "#F44336", textAlign: "center" }}>{error}</p>}
      
      {!loading && !error && (
        <>
          {/* Health Alerts Section */}
          {healthAlerts.length > 0 && (
            <div style={{ 
              marginBottom: "20px",
              padding: "15px",
              backgroundColor: "#FFF3E0",
              borderLeft: "4px solid #FFA000",
              borderRadius: "4px"
            }}>
              <h4 style={{ 
                marginTop: "0",
                marginBottom: "10px",
                color: "#E65100",
                fontSize: "16px"
              }}>
                ⚠️ Health Alerts
              </h4>
              <ul style={{ margin: "0", paddingLeft: "20px" }}>
                {healthAlerts.map((alert, index) => (
                  <li key={index} style={{ marginBottom: "5px" }}>
                    {alert.message} (Current: {alert.value})
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {healthData && (
            <div style={{ 
              marginBottom: "25px",
              padding: "20px",
              backgroundColor: "#ffffff",
              border: "1px solid #e0e0e0",
              borderRadius: "10px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)"
            }}>
              <div style={{ 
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px"
              }}>
                {avatar && <img 
                  src={avatar} 
                  alt="Patient Avatar" 
                  style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "3px solid #2c3e50"
                  }}
                />}
              </div>
              
              <h3 style={{
                marginBottom: "15px",
                color: "#3498db",
                fontSize: "18px",
                borderBottom: "1px solid #eee",
                paddingBottom: "8px"
              }}>
                Health Metrics
              </h3>
              
              <div style={{ 
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "15px"
              }}>
                <div>
                  <p><strong>Age:</strong> {healthData.age || "N/A"}</p>
                  <p><strong>Gender:</strong> {healthData.gender || "N/A"}</p>
                  <p>
                    <strong>BMI:</strong> 
                    <span style={highlightCondition(healthData.bmi, "bmi")}>
                      {healthData.bmi || "N/A"}
                    </span>
                  </p>
                </div>
                
                <div>
                  <p>
                    <strong>Blood Pressure:</strong> 
                    <span style={highlightCondition(healthData.blood_pressure, "blood_pressure")}>
                      {healthData.blood_pressure || "N/A"}
                    </span>
                  </p>
                  <p>
                    <strong>Cholesterol:</strong> 
                    <span style={highlightCondition(healthData.cholesterol, "cholesterol")}>
                      {healthData.cholesterol+" mg/dL" || "N/A"}
                    </span>
                  </p>
                  <p>
                    <strong>Diabetes:</strong> 
                    <span style={highlightCondition(healthData.diabetes, "diabetes")}>
                      {healthData.diabetes ? "Yes" : "No"}
                    </span>
                  </p>
                </div>
                
                <div>
                  <p>
                    <strong>Heart Attack:</strong> 
                    <span style={highlightCondition(healthData.heart_attack, "heart_attack")}>
                      {healthData.heart_attack ? "Yes" : "No"}
                    </span>
                  </p>
                  <p>
                    <strong>Family History of Heart Diseases:</strong> 
                    <span style={highlightCondition(healthData.heart_diseases, "heart_diseases")}>
                      {healthData.heart_diseases ? "Yes" : "No"}
                    </span>
                  </p>
                  <p><strong>Last Checkup:</strong> {healthData.last_checkup || "N/A"}</p>
                </div>
              </div>
            </div>
          )}
          
          {risk !== null && (
            <div style={{
              marginBottom: "30px",
              padding: "20px",
              backgroundColor: "#ffffff",
              borderRadius: "10px",
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)"
            }}>
              <p style={{ 
                marginBottom: "5px",
                color: "#7f8c8d",
                fontSize: "16px"
              }}>
                Predicted Disease Risk
              </p>
              <div style={{
                display: "inline-block",
                padding: "15px 25px",
                backgroundColor: getRiskColor(risk) + "20",
                borderRadius: "8px",
                border: `2px solid ${getRiskColor(risk)}`
              }}>
                <h3 style={{ 
                  margin: "0",
                  color: getRiskColor(risk),
                  fontSize: "32px",
                  fontWeight: "700"
                }}>
                  {risk}%
                </h3>
              </div>
              <p style={{
                marginTop: "10px",
                color: "#7f8c8d",
                fontSize: "14px"
              }}>
                {risk <= 50 ? "Low Risk" : risk <= 75 ? "Moderate Risk" : "High Risk"}
              </p>
            </div>
          )}
          
          <div style={{ marginTop: "30px" }}>
            <h3 style={{
              marginBottom: "15px",
              textAlign: "center",
              color: "#2c3e50",
              fontSize: "18px",
              borderBottom: "1px solid #eee",
              paddingBottom: "8px"
            }}>
              Quick Actions
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              {links.map((link, index) => (
                <Link
                  key={index}
                  to={link.path}
                  style={{
                    display: "block",
                    padding: "14px",
                    textAlign: "center",
                    backgroundColor: "#3498db",
                    color: "#fff",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontSize: "16px",
                    fontWeight: "500",
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)"
                  }}
                  onMouseOver={(e) => (e.target.style.backgroundColor = "#2980b9")}
                  onMouseOut={(e) => (e.target.style.backgroundColor = "#3498db")}
                  onMouseDown={(e) => (e.target.style.transform = "scale(0.98)")}
                  onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AddMedication;