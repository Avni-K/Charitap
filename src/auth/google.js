// src/auth/google.js
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

// Simplified Google OAuth implementation
export async function signInWithGoogleGSI() {
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your_google_client_id_here';
  
  if (clientId === 'your_google_client_id_here') {
    throw new Error('Please set up your Google Client ID in the environment variables. Add REACT_APP_GOOGLE_CLIENT_ID to your .env file.');
  }

  return new Promise((resolve, reject) => {
    // Create a popup window for Google OAuth
    const popup = window.open(
      `https://accounts.google.com/oauth/authorize?client_id=${clientId}&response_type=code&scope=openid%20email%20profile&redirect_uri=${encodeURIComponent(window.location.origin)}&state=google_signin`,
      'google_signin',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    // Check if popup was blocked or failed to open
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      reject(new Error('Popup was blocked. Please allow popups for this site and try again.'));
      return;
    }

    let intervalId;
    let messageHandler;

    // Clean up function
    const cleanup = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (messageHandler) {
        window.removeEventListener('message', messageHandler);
        messageHandler = null;
      }
    };

    // Check if popup is closed
    intervalId = setInterval(() => {
      try {
        if (popup && popup.closed) {
          cleanup();
          reject(new Error('Google sign-in was cancelled'));
        }
      } catch (error) {
        // Popup might be from different origin, ignore the error
        cleanup();
        reject(new Error('Google sign-in was cancelled'));
      }
    }, 1000);

    // Listen for messages from the popup
    messageHandler = (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data && event.data.type === 'GOOGLE_SIGNIN_SUCCESS') {
        cleanup();
        try {
          if (popup && !popup.closed) {
            popup.close();
          }
        } catch (error) {
          // Ignore errors when closing popup
        }
        
        try {
          const decoded = jwtDecode(event.data.credential);
          resolve({
            id: decoded.sub,
            email: decoded.email,
            firstName: decoded.given_name || '',
            lastName: decoded.family_name || '',
            fullName: decoded.name || '',
            picture: decoded.picture || ''
          });
        } catch (e) {
          reject(new Error('Failed to decode Google token'));
        }
      } else if (event.data && event.data.type === 'GOOGLE_SIGNIN_ERROR') {
        cleanup();
        try {
          if (popup && !popup.closed) {
            popup.close();
          }
        } catch (error) {
          // Ignore errors when closing popup
        }
        reject(new Error('Google sign-in failed'));
      }
    };

    window.addEventListener('message', messageHandler);
  });
}

// Export the components for use in the app
export { GoogleOAuthProvider, GoogleLogin };


