import React, { useState } from "react";
import axios from "axios";
import ENV from "../data/Env";
import Notiflix from "notiflix";
import medicines from "../data/Medicines";

// Configure Notiflix
Notiflix.Notify.init({
  position: 'right-top',
  timeout: 3000,
  width: '350px',
  fontSize: '14px'
});

const PrescriptionNotes = ({ user }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [parsedInfo, setParsedInfo] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [newMedicine, setNewMedicine] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [newDays, setNewDays] = useState("");

  const timeKeywords = ["morning", "afternoon", "evening", "before meal", "after meal"];

  // Validate medicine name
  const validateMedicineName = (name) => {
    if (!name || !name.trim()) {
      Notiflix.Notify.failure('Medicine name cannot be empty');
      return false;
    }
    if (name.length > 50) {
      Notiflix.Notify.failure('Medicine name is too long (max 50 characters)');
      return false;
    }
    return true;
  };

  // Validate dosage
  const validateDosage = (dosage) => {
    if (!dosage || !dosage.trim()) {
      Notiflix.Notify.failure('Dosage cannot be empty');
      return false;
    }

    const dosagePattern = /^(\d+mg|\d+ml|\d+\s*\/\s*\d+|[\d.]+\s*(mg|ml|g|tablet|tab|tabs)?)$/i;

    if (!dosagePattern.test(dosage)) {
      Notiflix.Notify.failure('Invalid dosage format. Examples: 500mg, 5ml, 1/2, 2 tablets');
      return false;
    }

    return true;
  };


  // Validate days
  const validateDays = (days) => {
    if (!days || !days.trim()) {
      Notiflix.Notify.failure('Days cannot be empty');
      return false;
    }

    const daysPattern = /^(\d+\s*(days?|weeks?|months?)|as\s+needed)$/i;

    if (!daysPattern.test(days)) {
      Notiflix.Notify.failure('Invalid days format. Examples: 5 days, 2 weeks, 1 month, as needed');
      return false;
    }

    return true;
  };


  // Validate schedule
  const validateSchedule = (schedule) => {
    if (!schedule || !schedule.trim()) {
      Notiflix.Notify.failure('Schedule cannot be empty');
      return false;
    }
    
    const validKeywords = ["morning", "afternoon", "evening", "before meal", "after meal", 
                          "1-0-1", "1-0-0", "0-1-0", "0-0-1", "1-1-1", "as needed"];
    const schedules = schedule.split(',').map(s => s.trim().toLowerCase());
    
    for (const s of schedules) {
      if (!validKeywords.includes(s)) {
        Notiflix.Notify.failure(`Invalid schedule: "${s}". Valid options: ${validKeywords.join(', ')}`);
        return false;
      }
    }
    
    return true;
  };

  // Handle file input change with validation
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      Notiflix.Notify.failure('Please upload an image (JPEG, PNG, GIF) or PDF file');
      e.target.value = ''; // Clear the file input
      return;
    }

    // Validate file size (5MB max)
    if (selectedFile.size > 5 * 1024 * 1024) {
      Notiflix.Notify.failure('File size too large. Maximum allowed is 5MB');
      e.target.value = ''; // Clear the file input
      return;
    }

    setFile(selectedFile);
  };

  // Enhanced file upload with validation
  const handleUpload = async () => {
    if (!file) {
      Notiflix.Notify.failure('Please select a file to upload');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      Notiflix.Loading.pulse('Processing prescription...');
      const response = await axios.post(`${ENV.SERVER}/api/parse-prescription-google`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.error) {
        Notiflix.Notify.failure(response.data.error);
      } else {
        const text = response.data.recognized_text;
        setRecognizedText(text);
        const extractedDetails = parseMedicalDetails(text);
        setParsedInfo(extractedDetails);
        Notiflix.Notify.success('Prescription parsed successfully!');
      }
    } catch (err) {
      Notiflix.Notify.failure('Failed to process prescription. Please try again.');
      console.error("Upload error:", err);
    } finally {
      Notiflix.Loading.remove();
      setLoading(false);
    }
  };

  // Enhanced prescription upload with validation
  const handlePrescriptionsUpload = async () => {
    if (!user) {
      Notiflix.Notify.failure('You must be logged in to upload prescriptions');
      return;
    }

    if (!parsedInfo || parsedInfo.length === 0) {
      Notiflix.Notify.failure('No prescription data to upload');
      return;
    }

    // Validate all medicine entries
    for (const medicine of parsedInfo) {
      if (!validateMedicineName(medicine.name) || 
          !validateDosage(medicine.dosage) || 
          !validateDays(medicine.days) ||
          !validateSchedule(medicine.interval.join(','))) {
        return;
      }
    }

    const requestBody = {
      user,
      medicines: parsedInfo
    };

    try {
      Notiflix.Loading.pulse('Uploading prescription data...');
      const response = await fetch(ENV.SERVER + "/prescriptionSchedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      Notiflix.Notify.success('Prescription data uploaded successfully!');
    } catch (error) {
      Notiflix.Notify.failure(`Upload failed: ${error.message}`);
      console.error("Upload error:", error);
    } finally {
      Notiflix.Loading.remove();
    }
  };

  // Parse medical details from text
  const parseMedicalDetails = (text) => {
    const popularMedicines = medicines;
    const dosagePattern = /(\d+mg|\d+ml|\d+\s*\/\s*\d+|\d+\s*(mg|ml|g|tablet|tab|tabs))/i;
    const daysPattern = /x\s*(\d+)\s*(days?|weeks?|months?)|(as\s+needed)/i;
    const intervalPattern = /(morning|afternoon|evening|before meal|after meal|1-0-1|1-0-0|0-1-0|0-0-1|1-1-1|as needed)/gi;
  
    const details = [];
  
    popularMedicines.forEach((med) => {
      const regex = new RegExp(`\\b${med}\\b`, "i");
      if (regex.test(text)) {
        // Extract dosage
        const dosageMatch = text.match(new RegExp(`${med}\\s*${dosagePattern.source}`, "i"));
        const dosage = dosageMatch ? dosageMatch[1] || "Unknown" : "Unknown";
  
        // Extract days
        const daysMatch = text.match(new RegExp(`${med}\\s*${daysPattern.source}`, "i"));
        const days = daysMatch ? `${daysMatch[1] || 'as needed'} ${daysMatch[2] || ''}`.trim() : "Unknown";
  
        // Extract intervals
        let foundIntervals = [];
        let match;
        while ((match = intervalPattern.exec(text)) !== null) {
          foundIntervals.push(match[0]);
        }
  
        const interval = foundIntervals.length > 0 ? [...new Set(foundIntervals)] : ["Unknown"];
  
        details.push({
          name: med,
          dosage: dosage,
          interval: interval,
          days: days,
          isPopular: true,
        });
      }
    });
  
    return details;
  };

  // Handle removing an interval
  const handleRemoveInterval = (medicineIndex, intervalIndex) => {
    setParsedInfo((prev) =>
      prev.map((item, index) =>
        index === medicineIndex
          ? { 
              ...item, 
              interval: item.interval.filter((_, i) => i !== intervalIndex) 
            }
          : item
      )
    );
    Notiflix.Notify.info('Schedule updated');
  };

  // Handle editing a medicine entry
  const handleEdit = (index, isManual) => {
    const itemToEdit = isManual ? schedule[index] : parsedInfo[index];
  
    const updatedName = prompt("Edit Medicine Name:", itemToEdit.name || itemToEdit[0]);
    if (updatedName !== null && !validateMedicineName(updatedName)) return;
    
    const updatedDosage = prompt("Edit Dosage:", itemToEdit.dosage || itemToEdit[1]);
    if (updatedDosage !== null && !validateDosage(updatedDosage)) return;
    
    const updatedDays = prompt("Edit Days:", itemToEdit.days || "Unknown");
    if (updatedDays !== null && !validateDays(updatedDays)) return;
    
    const updatedIntervalStr = prompt(
      "Edit Schedule (comma-separated):",
      itemToEdit.interval ? itemToEdit.interval.join(", ") : "Unknown"
    );
    if (updatedIntervalStr !== null && !validateSchedule(updatedIntervalStr)) return;
  
    if (updatedName && updatedDosage && updatedDays && updatedIntervalStr) {
      const updatedInfo = isManual ? [...schedule] : [...parsedInfo];
      updatedInfo[index] = {
        name: updatedName,
        dosage: updatedDosage,
        days: updatedDays,
        interval: updatedIntervalStr.split(",").map((item) => item.trim()),
      };
      
      isManual ? setSchedule(updatedInfo) : setParsedInfo(updatedInfo);
      Notiflix.Notify.success('Medicine updated successfully');
    }
  };

  // Handle adding new medicine
  const handleAddMedicine = (e) => {
    e.preventDefault();
    
    if (!validateMedicineName(newMedicine)) return;
    if (!validateDosage(newDosage)) return;
    if (!validateDays(newDays)) return;
    if (!validateSchedule(newSchedule)) return;

    const newEntry = {
      name: newMedicine.trim(),
      dosage: newDosage.trim(),
      days: newDays.trim(),
      interval: newSchedule.split(",").map((item) => item.trim()),
      isPopular: false
    };

    setParsedInfo([...(parsedInfo || []), newEntry]);
    setSchedule([...(schedule || []), newEntry]);

    // Reset form
    setNewMedicine("");
    setNewDosage("");
    setNewDays("");
    setNewSchedule("");

    Notiflix.Notify.success('Medicine added successfully');
  };

  const styles = {
    container: {
      padding: "20px",
      maxWidth: "800px",
      margin: "0 auto",
      fontFamily: "'Arial', sans-serif",
      backgroundColor: "#f9f9f9",
    },
    header: {
      textAlign: "center",
      color: "#333",
      marginBottom: "20px"
    },
    input: {
      display: "block",
      margin: "10px auto",
      padding: "12px",
      border: "1px solid #ddd",
      borderRadius: "6px",
      width: "100%",
      fontSize: "16px"
    },
    fileDisplay: {
      display: "flex",
      backgroundColor: '#e6f7ff',
      alignItems: "center",
      justifyContent: "center",
      margin: "15px auto",
      borderRadius: "10px",
      padding: "15px",
      border: "1px dashed #91d5ff"
    },
    fileIcon: {
      width: "50px",
      height: "50px",
      marginRight: "15px",
      opacity: 0.7
    },
    texts: {
      textAlign: "left"
    },
    fileName: {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "5px"
    },
    fileType: {
      fontSize: "14px",
      color: "#666",
    },
    button: {
      display: "block",
      width: "100%",
      padding: "12px",
      backgroundColor: "#1890ff",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      marginTop: "15px",
      fontSize: "16px",
      fontWeight: "500",
      transition: "background-color 0.3s"
    },
    buttonHover: {
      backgroundColor: "#40a9ff"
    },
    buttonDisabled: {
      backgroundColor: "#d9d9d9",
      cursor: "not-allowed"
    },
    error: {
      color: "#f5222d",
      textAlign: "center",
      margin: "10px 0",
      fontSize: "14px"
    },
    section: {
      marginTop: "25px",
      padding: "15px",
      backgroundColor: "#fff",
      borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
    },
    sectionTitle: {
      color: "#1890ff",
      marginBottom: "15px",
      borderBottom: "1px solid #eee",
      paddingBottom: "10px"
    },
    medicineCard: {
      border: "1px solid #e8e8e8",
      padding: "15px",
      borderRadius: "8px",
      marginBottom: "15px",
      backgroundColor: "#fff",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)"
    },
    tag: {
      display: "inline-flex",
      alignItems: "center",
      backgroundColor: "#f6ffed",
      color: "#52c41a",
      padding: "4px 10px",
      borderRadius: "15px",
      marginRight: "8px",
      marginBottom: "8px",
      fontSize: "14px",
      border: "1px solid #b7eb8f"
    },
    removeButton: {
      marginLeft: "5px",
      background: "none",
      border: "none",
      color: "#ff4d4f",
      cursor: "pointer",
      fontWeight: "bold",
      fontSize: "12px"
    }
  };

  return (
    <div className="recentOrders" style={styles.container}>
      <h2 style={styles.header}>Upload Medical Documents</h2>
      <p className="prepare-info" style={{ textAlign: 'center', color: '#666' }}>
        Upload medical documents or prescription notes to automatically extract medication information
      </p>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Upload Prescription</h3>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileChange}
          style={styles.input}
          id="prescriptionUpload"
        />
        {file && (
          <div style={styles.fileDisplay}>
            <img
              src="https://cdn-icons-png.flaticon.com/512/136/136526.png"
              alt="File Icon"
              style={styles.fileIcon}
            />
            <div style={styles.texts}>
              <div style={styles.fileName}>{file.name}</div>
              <div style={styles.fileType}>
                {file.type} • {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>
        )}
        <button 
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
            ...(!loading ? { ':hover': styles.buttonHover } : {})
          }} 
          onClick={handleUpload} 
          disabled={loading}
        >
          {loading ? "Processing..." : "Upload and Parse"}
        </button>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Add Medicine Manually</h3>
        <form onSubmit={handleAddMedicine}>
          <input
            type="text"
            placeholder="Medicine Name (e.g., Paracetamol)"
            value={newMedicine}
            onChange={(e) => setNewMedicine(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="text"
            placeholder="Dosage (e.g., 500mg, 5ml, 1/2 tablet)"
            value={newDosage}
            onChange={(e) => setNewDosage(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="text"
            placeholder="Duration (e.g., 5 days, 2 weeks, as needed)"
            value={newDays}
            onChange={(e) => setNewDays(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="text"
            placeholder="Schedule (comma-separated, e.g., morning,evening)"
            value={newSchedule}
            onChange={(e) => setNewSchedule(e.target.value)}
            style={styles.input}
            required
          />
          <button type="submit" style={styles.button}>
            Add Medicine
          </button>
        </form>
      </div>

      {error && (
        <div style={{ ...styles.section, borderLeft: '4px solid #f5222d' }}>
          <div style={styles.error}>{error}</div>
        </div>
      )}

      {recognizedText && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Recognized Text</h3>
          <div style={{
            backgroundColor: '#fafafa',
            padding: '15px',
            borderRadius: '4px',
            border: '1px solid #f0f0f0',
            maxHeight: '200px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap'
          }}>
            {recognizedText}
          </div>
        </div>
      )}

      {(parsedInfo && parsedInfo.length > 0) && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Extracted Prescription Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {parsedInfo.map((item, index) => (
              <div key={index} style={styles.medicineCard}>
                <p><strong>Medicine:</strong> {item.name}</p>
                <p><strong>Dosage:</strong> {item.dosage}</p>
                <p><strong>Duration:</strong> {item.days}</p>
                <div style={{ marginTop: '10px' }}>
                  <strong>Schedule:</strong>
                  <div style={{ marginTop: '8px' }}>
                    {item.interval.map((time, i) => (
                      <span key={i} style={styles.tag}>
                        {time}
                        <button
                          onClick={() => handleRemoveInterval(index, i)}
                          style={styles.removeButton}
                          title="Remove this schedule"
                        >
                          ✖
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <button 
                  style={{ 
                    ...styles.button, 
                    marginTop: '15px',
                    backgroundColor: '#13c2c2'
                  }} 
                  onClick={() => handleEdit(index, false)}
                >
                  Edit Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(parsedInfo && parsedInfo.length > 0) && (
        <div style={styles.section}>
          <button 
            style={{
              ...styles.button,
              backgroundColor: '#52c41a',
              ':hover': { backgroundColor: '#73d13d' }
            }} 
            onClick={handlePrescriptionsUpload}
            disabled={loading}
          >
            Save Prescription Data
          </button>
        </div>
      )}
    </div>
  );
};

export default PrescriptionNotes;