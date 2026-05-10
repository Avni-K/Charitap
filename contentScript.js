// ===================================================================
// Charitap Chrome Extension Content Script
// Universal E-Commerce Checkout Detection & Donation Widget
// ===================================================================

// Don't run on Charitap's own website
const currentUrl = window.location.href;
if (currentUrl.includes('localhost:3000') || 
    currentUrl.includes('127.0.0.1:3000') ||
    (window.location.hostname === 'localhost' && window.location.port === '3000')) {
  console.log('[Charitap] Skipping - running on Charitap website');
  // Exit script completely
  throw new Error('[Charitap] Script should not run on Charitap website');
}

console.log('[Charitap] Content script loaded');

// Global variables
var userId = null;
var userEmail = null;
var userToken = null;
var patterns = null;
var detectedPlatform = null;

// Session decline tracking
const DECLINE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// ===================================================================
// INITIALIZATION
// ===================================================================

async function hasDeclinedRecently() {
  // Check if session storage is available
  if (!chrome.storage || !chrome.storage.session) {
    return false; // Silently skip if not available
  }
  
  try {
    const result = await chrome.storage.session.get(['lastDeclineTimestamp']);
    const lastDecline = result.lastDeclineTimestamp;
    if (!lastDecline) return false;
    const timeSinceDecline = Date.now() - lastDecline;
    return timeSinceDecline < DECLINE_COOLDOWN_MS;
  } catch (error) {
    // Silently handle - decline tracking is non-critical
    return false;
  }
}

async function recordDecline() {
  // Check if session storage is available
  if (!chrome.storage || !chrome.storage.session) {
    return; // Silently skip if not available
  }
  
  try {
    await chrome.storage.session.set({ lastDeclineTimestamp: Date.now() });
    console.log('[Charitap] Decline recorded - 1 hour cooldown started');
  } catch (error) {
    // Silently handle - decline tracking is non-critical
  }
}

// Load patterns and initialize
async function initialize() {
  try {
    // Load e-commerce patterns
    const response = await fetch(chrome.runtime.getURL('patterns.json'));
    patterns = await response.json();

    // Load user data
    const userData = await chrome.storage.local.get(['userId', 'userEmail', 'userToken']);
    userId = userData.userId;
    userEmail = userData.userEmail;
    userToken = userData.userToken;

    console.log('[Charitap] Initialized', { userId: userId ? 'Present' : 'Missing' });

    // Check decline cooldown
    if (await hasDeclinedRecently()) {
      console.log('[Charitap] User in decline cooldown, skipping');
      return;
    }

    // Start detection
    if (userId && userEmail) {
      initDetection();
    }
  } catch (error) {
    console.error('[Charitap] Initialization failed:', error);
  }
}

// Check if user is logged in
chrome.storage.local.get(['userId', 'userEmail', 'userToken'], function(data) {
  console.log('[Charitap] User data from storage:', data);
  
  if (data.userId && data.userEmail && data.userToken) {
    userId = data.userId;
    userEmail = data.userEmail;
    userToken = data.userToken;
    console.log('[Charitap] User logged in, initializing...');
    initialize();
  } else {
    console.log('[Charitap] No user data found in storage');
  }
});

// Listen for login/logout events
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'userLoggedIn') {
    console.log('[Charitap] User logged in event received');
    userId = request.userId;
    userEmail = request.userEmail;
    userToken = request.userToken;
    initialize();
  } else if (request.action === 'userLoggedOut') {
    console.log('[Charitap] User logged out event received');
    userId = null;
    userEmail = null;
    userToken = null;
    removeWidget();
  } else if (request.action === 'walletUpdated') {
    console.log('[Charitap] Wallet updated, broadcasting to page');
    // Send message to page to update wallet balance
    window.postMessage({ type: 'CHARITAP_WALLET_UPDATE' }, '*');
  }
  sendResponse({status: 'ok'});
  return true;
});

// ===================================================================
// PLATFORM DETECTION
// ===================================================================

function detectPlatform() {
  if (!patterns) return null;

  const html = document.documentElement.innerHTML.toLowerCase();
  const url = window.location.href.toLowerCase();

  // Check exclusion patterns first
  if (patterns.excludePatterns) {
    for (const excludePattern of patterns.excludePatterns) {
      if (url.includes(excludePattern)) {
        console.log(`[Charitap] Site excluded: ${excludePattern}`);
        return null;
      }
    }
  }

  // Check each platform
  for (const [platformName, platformData] of Object.entries(patterns.platforms)) {
    if (platformData.identifier) {
      const identifier = String(platformData.identifier).toLowerCase();
      if (url.includes(identifier) || html.includes(identifier)) {
        console.log(`[Charitap] Platform detected: ${platformName} (identifier match)`);
        return platformName;
      }
    }

    // Check URL patterns
    if (platformData.urlPatterns) {
      for (const urlPattern of platformData.urlPatterns) {
        if (url.includes(String(urlPattern).toLowerCase())) {
          console.log(`[Charitap] Platform detected: ${platformName} (URL match)`);
          return platformName;
        }
      }
    }

    // Check HTML patterns
    if (platformData.htmlPatterns) {
      for (const htmlPattern of platformData.htmlPatterns) {
        if (html.includes(String(htmlPattern).toLowerCase())) {
          console.log(`[Charitap] Platform detected: ${platformName} (HTML match)`);
          return platformName;
        }
      }
    }
  }

  return null;
}

function isCheckoutPage() {
  const url = window.location.href.toLowerCase();
  
  if (patterns && Array.isArray(patterns.checkoutPatterns)) {
    for (const pattern of patterns.checkoutPatterns) {
      const patternUrl = typeof pattern === 'string' ? pattern : pattern.url;
      if (patternUrl && url.includes(String(patternUrl).toLowerCase())) {
        console.log('[Charitap] Checkout page detected via global pattern');
        return true;
      }
    }
  }

  // Use patterns if available
  if (patterns && detectedPlatform && patterns.platforms[detectedPlatform]) {
    const platformData = patterns.platforms[detectedPlatform];
    
    // Check checkout URL patterns
    if (platformData.checkoutPatterns) {
      for (const pattern of platformData.checkoutPatterns) {
        if (url.includes(pattern.toLowerCase())) {
          console.log('[Charitap] Checkout page detected via pattern');
          return true;
        }
      }
    }
  }

  // Fallback to generic keywords
  const checkoutKeywords = [
    'checkout', 'cart', 'basket', 'bag', 'payment',
    'pay', 'order', 'purchase', 'shipping', 'billing'
  ];
  
  return checkoutKeywords.some(keyword => url.includes(keyword));
}

function initDetection() {
  console.log('[Charitap] Starting detection...');
  
  // Detect platform
  detectedPlatform = detectPlatform();
  
  // Check if on checkout page
  if (isCheckoutPage()) {
    console.log('[Charitap] Checkout page detected');
    
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showWidget);
    } else {
      showWidget();
    }
  } else {
    console.log('[Charitap] Not a checkout page');
  }
}

// ===================================================================
// CART TOTAL DETECTION
// ===================================================================

function getCartTotal() {
  // Try to find cart total on the page
  const selectors = [];

  if (patterns && detectedPlatform && patterns.platforms[detectedPlatform]?.priceSelector) {
    selectors.push(...String(patterns.platforms[detectedPlatform].priceSelector).split(',').map((s) => s.trim()).filter(Boolean));
  }

  if (patterns && Array.isArray(patterns.priceSelectors)) {
    selectors.push(...patterns.priceSelectors.map((entry) => entry.selector).filter(Boolean));
  }

  selectors.push(
    '.order-total', '.cart-total', '.grand-total', '.total-price',
    '[class*="total"]', '[id*="total"]',
    '[data-test*="total"]', '[data-testid*="total"]'
  );
  
  for (const selector of selectors) {
    let elements = [];
    try {
      elements = document.querySelectorAll(selector);
    } catch (error) {
      continue;
    }
    for (const element of elements) {
      const text = element.textContent;
      const match = text.match(/[\$£€]?\s*(\d+[\.,]\d{2})/);
      if (match) {
        const value = parseFloat(match[1].replace(',', '.'));
        if (value > 0 && value < 10000) {
          return value;
        }
      }
    }
  }
  
  return null;
}

// ===================================================================
// WIDGET CREATION
// ===================================================================

function showWidget() {
  console.log('[Charitap] Showing widget...');
  
  // Remove existing widget
  removeWidget();
  
  // Get cart total
  const total = getCartTotal();
  console.log('[Charitap] Cart total:', total);
  
  if (total === null) {
    console.log('[Charitap] Could not detect cart total');
    return;
  }
  
  // Calculate roundup amount and fix floating point precision
  const roundUpAmount = Number((Math.ceil(total) - total).toFixed(2));
  console.log('[Charitap] Round up amount:', roundUpAmount);

  if (roundUpAmount <= 0) {
    console.log('[Charitap] Cart total is already a whole dollar; no round-up available');
    return;
  }
  
  // Create widget (USD only - US market)
  createWidget(total, roundUpAmount);
}

function createWidget(purchaseAmount, roundUpAmount) {
  console.log('[Charitap] Creating widget...');
  
  // Create the circular button
  const button = document.createElement('div');
  button.id = 'charitap-widget';
  button.className = 'charitap-widget-collapsed';
  button.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #626F47 0%, #8A9A5B 100%);
    border-radius: 50%;
    cursor: pointer;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(98, 111, 71, 0.35), 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    border: 3px solid rgba(252, 248, 241, 0.4);
  `;
  
  // Add charity icon
  const icon = document.createElement('img');
  icon.className = 'charitap-icon';
  icon.src = chrome.runtime.getURL('icons/icon128.png');
  icon.style.cssText = `
    width: 32px;
    height: 32px;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15));
    transition: all 0.3s ease;
    animation: heartbeat 2s ease-in-out infinite;
  `;
  button.appendChild(icon);
  
  // Add heartbeat animation
  if (!document.getElementById('charitap-heartbeat')) {
    const style = document.createElement('style');
    style.id = 'charitap-heartbeat';
    style.textContent = `
      @keyframes heartbeat {
        0%, 100% { transform: scale(1); }
        10% { transform: scale(1.1); }
        20% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Hover effect
  button.addEventListener('mouseenter', () => {
    if (button.classList.contains('charitap-widget-collapsed')) {
      button.style.transform = 'scale(1.12)';
      button.style.boxShadow = '0 8px 28px rgba(98, 111, 71, 0.45), 0 4px 12px rgba(0, 0, 0, 0.15)';
    }
  });
  
  button.addEventListener('mouseleave', () => {
    if (button.classList.contains('charitap-widget-collapsed')) {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 20px rgba(98, 111, 71, 0.35), 0 2px 8px rgba(0, 0, 0, 0.1)';
    }
  });
  
  // Click handler
  let isExpanded = false;
  button.addEventListener('click', () => {
    if (!isExpanded) {
      expandWidget(button, purchaseAmount, roundUpAmount);
      isExpanded = true;
    } else {
      collapseWidget(button);
      isExpanded = false;
      recordDecline();
    }
  });
  
  document.body.appendChild(button);
  console.log('[Charitap] Widget created successfully');
}

function expandWidget(button, purchaseAmount, roundUpAmount) {
  console.log('[Charitap] Expanding widget...');
  
  button.classList.remove('charitap-widget-collapsed');
  button.classList.add('charitap-widget-expanded');
  
  // Animate expansion
  button.style.width = '360px';
  button.style.height = '80px';
  button.style.borderRadius = '40px';
  button.style.boxShadow = '0 12px 32px rgba(98, 111, 71, 0.4), 0 4px 16px rgba(0, 0, 0, 0.12)';
  button.style.background = 'linear-gradient(135deg, rgba(252, 248, 241, 0.98) 0%, rgba(245, 236, 213, 0.98) 100%)';
  button.style.backdropFilter = 'blur(12px)';
  button.style.border = '3px solid rgba(98, 111, 71, 0.3)';
  
  // Wait for animation, then show content
  setTimeout(() => {
    button.innerHTML = '';
    
    // Create expanded content
    const content = document.createElement('div');
    content.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0 28px;
      opacity: 0;
      animation: charitapFadeIn 0.4s ease forwards;
    `;
    
    // Add animation keyframes
    if (!document.getElementById('charitap-animations')) {
      const style = document.createElement('style');
      style.id = 'charitap-animations';
      style.textContent = `
        @keyframes charitapFadeIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Icon
    const iconDiv = document.createElement('img');
    iconDiv.src = chrome.runtime.getURL('icons/icon128.png');
    iconDiv.style.cssText = `
      width: 40px;
      height: 40px;
      filter: drop-shadow(0 2px 6px rgba(98, 111, 71, 0.25));
      cursor: pointer;
      transition: transform 0.2s ease;
    `;
    iconDiv.title = 'Close';
    iconDiv.addEventListener('mouseenter', () => {
      iconDiv.style.transform = 'scale(1.1) rotate(-10deg)';
    });
    iconDiv.addEventListener('mouseleave', () => {
      iconDiv.style.transform = 'scale(1) rotate(0deg)';
    });
    iconDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseWidget(button);
      recordDecline();
    });
    content.appendChild(iconDiv);
    
    // Amount
    const amountDiv = document.createElement('div');
    amountDiv.textContent = `$${roundUpAmount.toFixed(2)}`;
    amountDiv.style.cssText = `
      color: #626F47;
      font-size: 28px;
      font-weight: 800;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      flex: 1;
      text-align: center;
      letter-spacing: 0;
      text-shadow: 0 2px 4px rgba(98, 111, 71, 0.1);
    `;
    content.appendChild(amountDiv);
    
    // Tick button
    const tickButton = document.createElement('div');
    tickButton.innerHTML = '✓';
    tickButton.style.cssText = `
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #626F47 0%, #8A9A5B 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      color: #FCF8F1;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 3px solid rgba(98, 111, 71, 0.2);
      box-shadow: 0 4px 12px rgba(98, 111, 71, 0.3);
    `;
    
    tickButton.addEventListener('mouseenter', () => {
      tickButton.style.transform = 'scale(1.15) rotate(5deg)';
      tickButton.style.boxShadow = '0 6px 16px rgba(98, 111, 71, 0.45)';
      tickButton.style.borderColor = 'rgba(240, 187, 120, 0.5)';
    });
    
    tickButton.addEventListener('mouseleave', () => {
      tickButton.style.transform = 'scale(1) rotate(0deg)';
      tickButton.style.boxShadow = '0 4px 12px rgba(98, 111, 71, 0.3)';
      tickButton.style.borderColor = 'rgba(98, 111, 71, 0.2)';
    });
    
    tickButton.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('[Charitap] Tick button clicked');
      handleDonation(purchaseAmount, roundUpAmount);
    });
    
    content.appendChild(tickButton);
    button.appendChild(content);
  }, 250);
}

function collapseWidget(button) {
  console.log('[Charitap] Collapsing widget...');
  
  button.classList.remove('charitap-widget-expanded');
  button.classList.add('charitap-widget-collapsed');
  
  // Fade out content
  const content = button.querySelector('div');
  if (content) {
    content.style.opacity = '0';
  }
  
  // Animate back to circle
  setTimeout(() => {
    button.style.width = '60px';
    button.style.height = '60px';
    button.style.borderRadius = '50%';
    button.style.boxShadow = '0 4px 16px rgba(98, 111, 71, 0.3)';
    
    // Restore icon
    setTimeout(() => {
      button.innerHTML = '';
      const icon = document.createElement('img');
      icon.className = 'charitap-icon';
      icon.src = chrome.runtime.getURL('icons/icon128.png');
      icon.style.cssText = `
        width: 32px;
        height: 32px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      `;
      button.appendChild(icon);
    }, 200);
  }, 100);
}

// ===================================================================
// DONATION HANDLING
// ===================================================================

function handleDonation(purchaseAmount, roundUpAmount) {
  console.log('[Charitap] Processing round-up:', { purchaseAmount, roundUpAmount });
  
  if (!userId || !userEmail) {
    console.error('[Charitap] User not logged in');
    showMessage('Please log in to Charitap to donate', 'error');
    return;
  }
  
  // Send message to background script to create roundup
  chrome.runtime.sendMessage({
    action: 'createRoundUp',
    data: {
      userEmail: userEmail,
      purchaseAmount: purchaseAmount,
      roundUpAmount: roundUpAmount,
      merchantName: window.location.hostname
    }
  }, (response) => {
    console.log('[Charitap] Response from background:', response);
    
    if (response && response.success) {
      const processed = Boolean(response.data?.settlement?.processed || response.data?.donationProcessed);
      showSuccessPopup(roundUpAmount, processed);
      removeWidget();
      
      // Broadcast wallet update
      chrome.runtime.sendMessage({ action: 'walletUpdated' });
    } else {
      showMessage(response?.error || 'Failed to save round-up', 'error');
    }
  });
}

// ===================================================================
// SUCCESS POPUP
// ===================================================================

function showSuccessPopup(amount, processed = false) {
  // Create success popup
  const popup = document.createElement('div');
  popup.id = 'charitap-success-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.85);
    background: linear-gradient(135deg, rgba(252, 248, 241, 0.98) 0%, rgba(245, 236, 213, 0.98) 100%);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    padding: 48px 40px;
    box-shadow: 0 20px 60px rgba(98, 111, 71, 0.3), 0 8px 24px rgba(0, 0, 0, 0.12);
    z-index: 10000000;
    min-width: 360px;
    text-align: center;
    border: 3px solid rgba(98, 111, 71, 0.25);
    opacity: 0;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  `;
  
  // Success icon
  const icon = document.createElement('div');
  icon.textContent = processed ? 'Processed' : 'Saved';
  icon.style.cssText = `
    font-size: 20px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0;
    margin-bottom: 24px;
    color: #626F47;
  `;
  
  // Success text
  const title = document.createElement('div');
  title.textContent = processed ? 'Donation processed' : 'Round-up saved';
  title.style.cssText = `
    font-size: 28px;
    font-weight: 800;
    color: #626F47;
    margin-bottom: 14px;
    letter-spacing: 0;
    text-shadow: 0 2px 4px rgba(98, 111, 71, 0.1);
  `;
  
  // Amount text
  const amountText = document.createElement('div');
  amountText.textContent = processed
    ? `$${amount.toFixed(2)} was included in a donation batch`
    : `$${amount.toFixed(2)} added to your pending round-ups`;
  amountText.style.cssText = `
    font-size: 19px;
    color: #8A9A5B;
    margin-bottom: 28px;
    font-weight: 600;
  `;
  
  // Close button (initially hidden)
  const closeBtn = document.createElement('div');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(98, 111, 71, 0.12);
    color: #626F47;
    font-size: 32px;
    line-height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: all 0.3s ease;
    font-weight: 300;
  `;
  
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'rgba(98, 111, 71, 0.2)';
    closeBtn.style.transform = 'scale(1.1) rotate(90deg)';
  });
  
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'rgba(98, 111, 71, 0.12)';
    closeBtn.style.transform = 'scale(1) rotate(0deg)';
  });
  
  closeBtn.addEventListener('click', () => {
    removeSuccessPopup();
  });
  
  // Progress bar
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    height: 5px;
    background: linear-gradient(90deg, #626F47 0%, #8A9A5B 50%, #F0BB78 100%);
    border-radius: 0 0 22px 22px;
    width: 100%;
    animation: charitapProgress 2s linear forwards;
    box-shadow: 0 -2px 8px rgba(98, 111, 71, 0.2);
  `;
  
  // Add animations
  if (!document.getElementById('charitap-success-animations')) {
    const style = document.createElement('style');
    style.id = 'charitap-success-animations';
    style.textContent = `
      @keyframes charitapBounce {
        0%, 100% { transform: translateY(0) scale(1); }
        30% { transform: translateY(-12px) scale(1.1); }
        50% { transform: translateY(0) scale(1); }
      }
      @keyframes charitapProgress {
        from { width: 100%; }
        to { width: 0%; }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Show close button on hover
  popup.addEventListener('mouseenter', () => {
    closeBtn.style.opacity = '1';
  });
  
  popup.addEventListener('mouseleave', () => {
    closeBtn.style.opacity = '0';
  });
  
  // Assemble popup
  popup.appendChild(closeBtn);
  popup.appendChild(icon);
  popup.appendChild(title);
  popup.appendChild(amountText);
  popup.appendChild(progressBar);
  
  document.body.appendChild(popup);
  
  // Animate in
  setTimeout(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
  
  // Auto-dismiss after 2 seconds
  setTimeout(() => {
    removeSuccessPopup();
  }, 2000);
}

function removeSuccessPopup() {
  const popup = document.getElementById('charitap-success-popup');
  if (popup) {
    popup.style.opacity = '0';
    popup.style.transform = 'translate(-50%, -50%) scale(0.8)';
    setTimeout(() => popup.remove(), 400);
  }
  
  // Remove confetti
  const confetti = document.getElementById('charitap-confetti');
  if (confetti) {
    confetti.remove();
  }
}

function createConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'charitap-confetti';
  canvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999999;
  `;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  document.body.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  const pieces = [];
  const numberOfPieces = 100;
  const colors = ['#626F47', '#8A9A5B', '#F0BB78', '#FCF8F1', '#E8DCC4'];
  
  // Create confetti pieces
  for (let i = 0; i < numberOfPieces; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      rotation: Math.random() * 360,
      speed: 2 + Math.random() * 3,
      size: 5 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotationSpeed: (Math.random() - 0.5) * 10
    });
  }
  
  // Animate confetti
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    pieces.forEach((piece, index) => {
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate((piece.rotation * Math.PI) / 180);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
      ctx.restore();
      
      piece.y += piece.speed;
      piece.rotation += piece.rotationSpeed;
      
      if (piece.y > canvas.height) {
        pieces.splice(index, 1);
      }
    });
    
    if (pieces.length > 0) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }
  
  animate();
}

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

function showMessage(text, type) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : '#f44336'};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    z-index: 1000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    opacity: 0;
    transform: translateY(-20px);
    transition: all 0.3s ease;
  `;
  toast.textContent = text;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function removeWidget() {
  const existing = document.getElementById('charitap-widget');
  if (existing) {
    existing.remove();
    console.log('[Charitap] Widget removed');
  }
}
