// == Content Script =========================================================

var userId = null;
var userEmail = null;
var userToken = null;

function onGot(item) {
  console.log('Retrieved user data:', {
    userId: item.userId,
    userEmail: item.userEmail,
    userToken: item.userToken ? 'Present' : 'Missing'
  });
  userId = item.userId;
  userEmail = item.userEmail;
  userToken = item.userToken;
}

function onError(error) {
  console.log(`Error: ${error}`);
  userId = null;
  userEmail = null;
  userToken = null;
}

// 1) Simple heuristic: look for forms/buttons with payment keywords
function looksLikePaymentPage() {
    var pattern = ['checkout', 'billing', 'purchase'];

    for (const word of pattern) {
      if (window.location.href.toLowerCase().includes(word)) {
        return true;
    }
    }
    return false;
  }
  
  // contentScript.js

// 2) Inject a round button with transitions enabled
function injectButton(totalCheckoutAmount) {
    if (document.getElementById("roundUpCharityBtn")) return;
  
    const btn = document.createElement("div");
    btn.id = "roundUpCharityBtn";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "60px",
      height: "60px",
      borderRadius: "50%",
      background: "#e0e0e0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      zIndex: "999999",
      transition: "width 0.4s ease, border-radius 0.4s ease, padding 0.4s ease"
    });
  
    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("assets/charity.png");
    img.alt = "Donate";
    Object.assign(img.style, {
      width: "42px",
      height: "42px",
      objectFit: "contain",
      transition: "opacity 0.3s ease"
    });
    btn.appendChild(img);
    img.addEventListener("click", () => {
      transformToBar(totalCheckoutAmount);
      img.removeEventListener("click", transformToBar);
      img.addEventListener("click", () => {
        console.log("Click once")
        btn.remove();
        injectButton(totalCheckoutAmount);
        //revertToCircle(btn);
      });
    });
    //btn.addEventListener("click", () => {transformToBar(totalCheckoutAmount);
      //btn.insertAdjacentText('beforeend', ` Total: ${totalCheckoutAmount ? totalCheckoutAmount : 0}`);
    //});
    document.body.appendChild(btn);
  }
  
  
  // 2a) Morph the circle into a bar, then fade in the actions
  function transformToBar(totalCheckoutAmount) {
    const btn = document.getElementById("roundUpCharityBtn");
    if (!btn) return;
  
    // 1) Prepare for morph
    //btn.removeEventListener("click", transformToBar);
    btn.style.justifyContent = "flex-end";
    btn.style.padding = "0 15px";
    btn.style.width = "200px";
    btn.style.borderRadius = "30px";
  
    // 2) Once the width transition finishes, swap in the buttons
    const onEnd = e => {
      if (e.propertyName !== "width") return;
      btn.removeEventListener("transitionend", onEnd);
  
      // Amount Field

      // create ✓
      const tick = document.createElement("button");
      tick.innerText = "✓";
      Object.assign(tick.style, {
        width: "40px", height: "40px",
        borderRadius: "20px", border: "none",
        background: "#e0e0e0", color: "#4CAF50",
        fontSize: "20px", cursor: "pointer",
        marginRight: "10px",
        opacity: "0", transition: "opacity 0.3s ease"
      });
  
      // wire up actions
      // btn.addEventListener("click", () => {
      //   console.log("Click once")
      //   btn.remove();
      //   injectButton(totalCheckoutAmount);
      //   //revertToCircle(btn);
      // });
      tick.addEventListener("click", async () => {
        // donation logic...
        updateResource(totalCheckoutAmount);
        // data = chrome.storage.local.get({userId: null});
        btn.remove();
        injectButton(totalCheckoutAmount);
      });
  
      // append in order
      btn.append(tick);
      btn.insertAdjacentText('beforeend', ` Total: $${totalCheckoutAmount ? totalCheckoutAmount : 0}`);
      // trigger fade‑in
      requestAnimationFrame(() => {
        tick.style.opacity = "1";
      });
    };
  
    btn.addEventListener("transitionend", onEnd);
  }
  
  function findCheckoutTotal() {
    // 1. Define the currency regex (add symbols as you like)
    const currencyRegex = /[$€£₹¥]\s?\d{1,3}(?:[,.\d{3}])*(?:\.\d{2})?/g;
  
    // 2. Walk all text nodes in the body
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const matches = [];
    while (walker.nextNode()) {
      const text = walker.currentNode.nodeValue;
      let m;
      while ((m = currencyRegex.exec(text))) {
        // parseFloat after stripping non‑digits except the dot
        const num = parseFloat(m[0].replace(/[^0-9.]/g, ''));
        matches.push({ value: num, raw: m[0], node: walker.currentNode });
      }
    }
  
    if (!matches.length) {
      return -1;
    }
  
    // 3. Filter by “total”‑like keywords in the element’s context
    const totalKeywords = /total|amount due|grand total|order total|payable/i;
    const totalMatches = matches.filter(({node}) => {
      const ctx = node.parentElement.innerText || "";
      return totalKeywords.test(ctx);
    });
  
    // 4. Decide which value to report
    const chosen = (totalMatches.length ? totalMatches : matches)
      .reduce((best, cur) => cur.value > best.value ? cur : best, { value: -Infinity })
      .value;
  
    return chosen;
  }
  
  function roundToTwo(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

// bar → circle
function revertToCircle(btn) {
  // 1) fade out children
  Array.from(btn.children).forEach(ch => ch.style.opacity = "0");

  // 2) once fade completes, morph back
  btn.addEventListener("transitionend", function onFade(e) {
    if (e.propertyName !== "opacity") return;
    btn.removeEventListener("transitionend", onFade);

    // clear out children
    btn.innerHTML = "";
    btn.classList.remove("is-bar");

    // 3) morph styles back
    btn.style.justifyContent = "center";
    btn.style.padding      = "0";
    btn.style.width        = "60px";
    btn.style.borderRadius = "50%";

    // 4) after shape morph, re-insert single icon
    btn.addEventListener("transitionend", function onMorphBack(e2) {
      if (e2.propertyName !== "width") return;
      btn.removeEventListener("transitionend", onMorphBack);

      // insert the single charity image, start hidden
      const img = document.createElement("img");
      img.src    = chrome.runtime.getURL("assets/charity.png");
      img.alt    = "Donate";
      Object.assign(img.style, {
        width: "70%", height: "70%", objectFit: "contain",
        opacity: "0", transition: "opacity 0.3s ease"
      });
      btn.appendChild(img);

      // fade it back in
      requestAnimationFrame(() => img.style.opacity = "1");

      // restore click handler
      btn.addEventListener("click", transformToBar);
    });
  });
}

  // 5) Kick off
if (looksLikePaymentPage()) {
  let gettingItem = chrome.storage.local.get(["userId", "userEmail", "userToken"]);
  gettingItem.then(onGot, onError);
  var checkoutTotal = findCheckoutTotal();
  if (checkoutTotal !== -1) {
    var donation = Math.ceil(checkoutTotal) - checkoutTotal;
    if (donation == 0) {
      donation = 1.00;
    }
    injectButton(roundToTwo(donation));
  } else {
    // console.log(checkoutTotal);
    injectButton();
  }
}
  

async function updateResource(totalCheckoutAmount) {
  try {
    var user = userId;
    const bodyJson = { "user": user, "purchaseAmount": checkoutTotal, "roundUpAmount": totalCheckoutAmount };
    console.log('Sending request with body:', bodyJson);
    console.log('Using JWT token:', userToken ? 'Present' : 'Missing');
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add Authorization header if token is available
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }
    
    const res = await fetch(`http://localhost:3001/api/roundup/create-roundup`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(bodyJson)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`HTTP ${res.status}: ${errorText}`);
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    
    const data = await res.json();
    console.log('Server replied:', data);
    return data;
  } catch (err) {
    console.error('API call failed:', err);
    throw err;
  }
}