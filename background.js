// Global variables to store the current user data
let currentUserId = null;
let currentUserEmail = null;
let currentUserToken = null;
const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';

// Initialize the extension by retrieving stored user data
chrome.storage.local.get(['userId', 'userEmail', 'userToken', 'charitapApiBaseUrl'], (result) => {
  if (chrome.runtime.lastError) {
    console.error(`Service Worker: Error retrieving user data from chrome.storage: ${chrome.runtime.lastError.message}`);
  } else {
    currentUserId = result.userId;
    currentUserEmail = result.userEmail;
    currentUserToken = result.userToken;
    console.log(`Service Worker: Retrieved stored user data - ID: '${currentUserId}', Email: '${currentUserEmail}', Token: ${currentUserToken ? 'Present' : 'Missing'}`);
  }
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {

  if (message.type === "SAVE_USER_DATA") {
    const receivedEmail = message.email;
    const receivedUserId = message.userId;
    const receivedToken = message.token;
    const receivedApiBaseUrl = message.apiBaseUrl;

    console.log(`Service Worker: Received user data from ${sender.origin} - Email: '${receivedEmail}', UserID: '${receivedUserId}', Token: ${receivedToken ? 'Present' : 'Missing'}`);

    if (!receivedUserId || !receivedEmail || !receivedToken) {
      sendResponse({ status: "error", message: "Missing Charitap user data." });
      return true;
    }

    // Update current user data
    currentUserId = receivedUserId;
    currentUserEmail = receivedEmail;
    currentUserToken = receivedToken;

    // Store user data
    chrome.storage.local.set({
      userId: receivedUserId,
      userEmail: receivedEmail,
      userToken: receivedToken,
      charitapApiBaseUrl: receivedApiBaseUrl || DEFAULT_API_BASE_URL
    }, () => {
      if (chrome.runtime.lastError) {
        console.error(`Service Worker: Error saving user data to chrome.storage: ${chrome.runtime.lastError.message}`);
        sendResponse({ status: "error", message: "Extension failed to store user data." });
      } else {
        console.log(`Service Worker: User data saved successfully.`);
        sendResponse({ status: "success", message: "User data received and stored by extension." });
      }
    });
  } else if (message.type === "CLEAR_USER_DATA") {
    currentUserId = null;
    currentUserEmail = null;
    currentUserToken = null;

    chrome.storage.local.remove(['userId', 'userEmail', 'userToken'], () => {
      if (chrome.runtime.lastError) {
        console.error(`Service Worker: Error clearing user data: ${chrome.runtime.lastError.message}`);
        sendResponse({ status: "error", message: "Extension failed to clear user data." });
      } else {
        console.log('Service Worker: User data cleared successfully.');
        sendResponse({ status: "success", message: "User data cleared by extension." });
      }
    });
  } else {
    // Handle legacy message format for backward compatibility
    const receivedUserId = message.email;
    console.log(`Service Worker: Received legacy Email '${receivedUserId}' from ${sender.origin}`);

    // Update current user ID
    currentUserId = receivedUserId;
    currentUserEmail = receivedUserId;

    // Store User ID
    chrome.storage.local.set({ userId: receivedUserId, userEmail: receivedUserId }, () => {
      if (chrome.runtime.lastError) {
        console.error(`Service Worker: Error saving User ID to chrome.storage: ${chrome.runtime.lastError.message}`);
        sendResponse({ status: "error", message: "Extension failed to store User ID." });
      } else {
        console.log(`Service Worker: Email '${receivedUserId}' saved successfully.`);
        sendResponse({ status: "success", message: "User ID received and stored by extension." });
      }
    });
  }

  // Indicate asynchronous response
  return true;
});

// Listen for internal messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service Worker: Received internal message:', message);

  if (message.action === 'createRoundUp') {
    // Extract data from message
    const { userEmail, purchaseAmount, roundUpAmount, amount, merchantName } = message.data || {};
    const normalizedRoundUpAmount = Number(roundUpAmount ?? amount);
    const normalizedPurchaseAmount = Number(purchaseAmount ?? 0);

    console.log(`Service Worker: Creating roundup for ${userEmail}, purchase: $${normalizedPurchaseAmount}, roundup: $${normalizedRoundUpAmount}`);

    // Check if we have data in memory, if not, try to get from storage again
    const getAuthData = () => {
      if (currentUserToken && currentUserEmail) {
        return Promise.resolve({ token: currentUserToken, email: currentUserEmail });
      }
      return new Promise((resolve) => {
        chrome.storage.local.get(['userToken', 'userEmail'], (res) => {
          currentUserToken = res.userToken || currentUserToken;
          currentUserEmail = res.userEmail || currentUserEmail;
          resolve({ token: currentUserToken, email: currentUserEmail });
        });
      });
    };

    getAuthData().then(({ token, email }) => {
      if (!token || !email) {
        console.error('Service Worker: No auth data available');
        sendResponse({ success: false, error: 'Not authenticated. Please log in to Charitap.' });
        return;
      }

      if (!Number.isFinite(normalizedPurchaseAmount) || normalizedPurchaseAmount <= 0 || !Number.isFinite(normalizedRoundUpAmount) || normalizedRoundUpAmount <= 0) {
        sendResponse({ success: false, error: 'Invalid roundup payload' });
        return;
      }

      // Call backend API to create roundup.
      chrome.storage.local.get(['charitapApiBaseUrl'], ({ charitapApiBaseUrl }) => {
        const apiBaseUrl = charitapApiBaseUrl || DEFAULT_API_BASE_URL;
        console.log(`Service Worker: Fetching ${apiBaseUrl}/roundup/create-roundup`);

        fetch(`${apiBaseUrl}/roundup/create-roundup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            purchaseAmount: normalizedPurchaseAmount,
            roundUpAmount: normalizedRoundUpAmount,
            merchantName: merchantName || 'Unknown Merchant'
          })
        })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || data.message || `Round-up request failed with ${response.status}`);
          }
          return data;
        })
        .then(data => {
          console.log('Service Worker: Roundup created successfully:', data);
          sendResponse({ success: true, data: data });
          
          // Broadcast wallet update to all tabs
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, { type: 'CHARITAP_WALLET_UPDATE' }).catch(() => {});
            });
          });
        })
        .catch(error => {
          console.error('Service Worker: Error creating roundup:', error);
          sendResponse({ success: false, error: error.message });
        });
      });
    });

    return true; // Keep message channel open
  }

  if (message.action === 'walletUpdated') {
    console.log('Service Worker: Wallet updated, broadcasting to tabs');

    // Broadcast to all tabs including the website
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        // Send to content scripts
        chrome.tabs.sendMessage(tab.id, {
          type: 'CHARITAP_WALLET_UPDATE'
        }).catch(() => {});

        // Also try to send to the page directly via postMessage
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            window.postMessage({ type: 'CHARITAP_WALLET_UPDATE' }, '*');
          }
        }).catch(() => {});
      });
    });

    sendResponse({ success: true });
    return true;
  }
});
