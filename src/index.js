import React from 'react';
import ReactDOM from 'react-dom/client';
// Removed Auth0; using custom AuthProvider backed by Firebase Auth
import { AuthProvider } from './auth/AuthContext';
import { ToastContainer, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/main.css';
import App from './App';
import { BrowserRouter as Router } from 'react-router-dom';

// No Auth0 configuration needed

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <Router>
        <App />
      </Router>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Slide}
      />
    </AuthProvider>
  </React.StrictMode>
);
