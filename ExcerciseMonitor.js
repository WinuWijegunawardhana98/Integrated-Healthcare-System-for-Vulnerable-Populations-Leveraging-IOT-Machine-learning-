// pages/Dashboard.js
import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Footer from '../components/Footer';
import MedicineCaution from '../components/MedicineCaution';
import DetailsForm from '../components/DetailsForm';
import ActivityList from '../components/ActivityList';

const ExcerciseMonitor = () => {
  const [user, setUser] = useState(() => {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : {};
    });


  return (
    <div className="container">
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="details">
          <ActivityList username={{ username: user.username || '' }}/>
          <MedicineCaution />
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default ExcerciseMonitor;
