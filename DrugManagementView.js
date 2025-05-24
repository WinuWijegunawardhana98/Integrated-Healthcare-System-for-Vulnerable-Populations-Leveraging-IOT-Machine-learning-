import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ENV from '../data/Env';
import { Bar, Pie } from 'react-chartjs-2';
import ChartJS from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Notiflix from 'notiflix';

// Configure Notiflix
Notiflix.Notify.init({
  position: 'right-top',
  timeout: 3000,
  width: '350px',
  fontSize: '14px'
});

const DrugsManagementView = ({ username }) => {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMedications = async () => {
      try {
        Notiflix.Loading.pulse('Loading medication data...');
        const response = await axios.get(`${ENV.SERVER}/medication-all/${username}`);
        setMedications(response.data);
        Notiflix.Loading.remove();
      } catch (err) {
        console.error('Error fetching medications:', err);
        setError('Failed to load medications');
        Notiflix.Notify.failure('Failed to load medication data');
        Notiflix.Loading.remove();
      } finally {
        setLoading(false);
      }
    };

    fetchMedications();
  }, [username]);

  // Generate PDF report
  const generatePDF = () => {
  if (medications.length === 0) {
    Notiflix.Notify.warning('No medication data available to generate report');
    return;
  }

  try {
    Notiflix.Loading.pulse('Generating PDF report...');

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text(`Medication Report for ${username}`, 105, 20, null, null, 'center');

    // Date range
    const dates = medications.map(m => m.date);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    doc.setFontSize(12);
    doc.text(`Date Range: ${startDate} to ${endDate}`, 105, 30, null, null, 'center');

    // Summary table
    doc.setFontSize(14);
    doc.text('Medication Summary', 14, 40);

    const summaryData = {};

    medications.forEach(day => {
      day.medications.forEach(med => {
        if (!summaryData[med.name]) {
          summaryData[med.name] = { taken: 0, missed: 0 };
        }
        if (med.taken) {
          summaryData[med.name].taken += 1;
        } else {
          summaryData[med.name].missed += 1;
        }
      });
    });

    const summaryTableData = Object.keys(summaryData).map(name => {
      const taken = summaryData[name].taken;
      const missed = summaryData[name].missed;
      const adherence = taken + missed > 0
        ? `${Math.round((taken / (taken + missed)) * 100)}%`
        : 'N/A';

      return [name, taken, missed, adherence];
    });

    doc.autoTable({
      startY: 45,
      head: [['Medication', 'Taken', 'Missed', 'Adherence %']],
      body: summaryTableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Daily medication details
    const dailyStartY = doc.autoTable.previous.finalY + 15;
    doc.setFontSize(14);
    doc.text('Daily Medication Details', 14, dailyStartY);

    const dailyTableData = [];
    medications.forEach(day => {
      day.medications.forEach(med => {
        dailyTableData.push([
          day.date,
          med.name,
          med.dosage,
          med.taken ? 'Yes' : 'No',
          med.time || 'N/A',
        ]);
      });
    });

    doc.autoTable({
      startY: doc.autoTable.previous.finalY + 20,
      head: [['Date', 'Medication', 'Dosage', 'Taken', 'Time']],
      body: dailyTableData,
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 50 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 30 },
      },
      styles: { fontSize: 9 },
      pageBreak: 'auto',
    });

    // Save the PDF
    const fileName = `Medication_Report_${username}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);

    Notiflix.Loading.remove();
    Notiflix.Notify.success('PDF report generated successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    Notiflix.Loading.remove();
    Notiflix.Notify.failure('Failed to generate PDF report');
  }
};


  // Prepare data for Bar Chart (Only Taken Medications)
  const prepareBarChartData = () => {
    const medicationCounts = {};
    const labels = new Set();
    const datasets = [];

    medications.forEach((record) => {
      labels.add(record.date);
      record.medications.forEach((med) => {
        if (med.taken) {
          if (!medicationCounts[med.name]) {
            medicationCounts[med.name] = {};
          }
          if (!medicationCounts[med.name][record.date]) {
            medicationCounts[med.name][record.date] = 0;
          }
          medicationCounts[med.name][record.date] += 1;
        }
      });
    });

    Object.keys(medicationCounts).forEach((medName) => {
      const color = medications[0]?.medications.find((med) => med.name === medName)?.color || "#" + Math.floor(Math.random()*16777215).toString(16);
      datasets.push({
        label: medName,
        data: Array.from(labels).map((date) => medicationCounts[medName][date] || 0),
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1,
      });
    });

    return {
      labels: Array.from(labels),
      datasets: datasets,
    };
  };

  // Prepare data for Pie Chart (Missed Medications)
  const preparePieChartData = () => {
    const missedCounts = {};

    medications.forEach((record) => {
      record.medications.forEach((med) => {
        if (!med.taken) {
          if (!missedCounts[med.name]) {
            missedCounts[med.name] = 0;
          }
          missedCounts[med.name] += 1;
        }
      });
    });

    // Generate colors if not available
    const colors = Object.keys(missedCounts).map((_, i) => {
      const hue = (i * 137.508) % 360; // Golden angle approximation
      return `hsl(${hue}, 70%, 60%)`;
    });

    return {
      labels: Object.keys(missedCounts),
      datasets: [
        {
          data: Object.values(missedCounts),
          backgroundColor: colors,
          hoverBackgroundColor: colors.map(c => c.replace('60%)', '50%)')),
        },
      ],
    };
  };

  const barChartData = prepareBarChartData();
  const pieChartData = preparePieChartData();

  // Chart options
  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Medication Count by Date',
        font: {
          size: 18,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Amount of Medications taken',
        },
        beginAtZero: true,
      },
    },
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Missed Medications Over Week',
        font: {
          size: 18,
        },
      },
    },
  };

  const styles = {
    container: {
      padding: "20px",
      maxWidth: "1200px",
      margin: "0 auto",
      fontFamily: "'Arial', sans-serif",
      backgroundColor: "#f9f9f9",
    },
    header: {
      textAlign: "center",
      color: "#333",
      marginBottom: "20px"
    },
    userInfo: {
      backgroundColor: "#e6f7ff",
      padding: "15px",
      borderRadius: "8px",
      marginBottom: "20px",
      border: "1px solid #91d5ff",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    error: {
      color: "#f5222d",
      textAlign: "center",
      margin: "20px 0",
      padding: "15px",
      backgroundColor: "#fff1f0",
      border: "1px solid #ffa39e",
      borderRadius: "8px"
    },
    chartContainer: {
      backgroundColor: "#fff",
      padding: "20px",
      borderRadius: "8px",
      marginBottom: "20px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
    },
    chartTitle: {
      color: "#1890ff",
      marginBottom: "15px",
      borderBottom: "1px solid #eee",
      paddingBottom: "10px"
    },
    button: {
      backgroundColor: "#1890ff",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      padding: "10px 20px",
      cursor: "pointer",
      fontSize: "16px",
      fontWeight: "500",
      transition: "background-color 0.3s",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    },
    buttonHover: {
      backgroundColor: "#40a9ff"
    },
    loading: {
      textAlign: "center",
      padding: "20px",
      color: "#666"
    }
  };

  return (
    <div className="recentOrders" >
      <h2 style={styles.header}>Medication Management</h2>

      {/* User Information */}
      <div style={styles.userInfo}>
        <p style={{ margin: 0 }}>Managing medications for: <strong>{username}</strong></p>
        <button 
          style={styles.button}
          onClick={generatePDF}
          disabled={loading || medications.length === 0}
        >
          <span>Download PDF Report</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      </div>

      {/* Display error message if any */}
      {error && <div style={styles.error}>{error}</div>}

      {/* Display loading indicator */}
      {loading ? (
        <div style={styles.loading}>Loading medications...</div>
      ) : (
        <div>
          {/* Bar Chart Section */}
          <div style={styles.chartContainer}>
            <h3 style={styles.chartTitle}>Medication Takes by Date</h3>
            <Bar data={barChartData} options={barChartOptions} />
          </div>

          {/* Pie Chart Section */}
          <div style={styles.chartContainer}>
            <h3 style={styles.chartTitle}>Missed Medications Over Week</h3>
            <Pie data={pieChartData} options={pieChartOptions} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DrugsManagementView;