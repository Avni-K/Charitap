exports = async function(changeEvent) {
  const backendUrl = context.values.get("CHARITAP_BACKEND_URL");
  const triggerSecret = context.values.get("CHARITAP_ATLAS_TRIGGER_SECRET");

  if (!backendUrl || !triggerSecret) {
    console.log("Missing CHARITAP_BACKEND_URL or CHARITAP_ATLAS_TRIGGER_SECRET");
    return;
  }

  const fullDocument = changeEvent.fullDocument || {};
  const email = fullDocument.email || fullDocument.user;
  if (!email) {
    console.log("No user email found on change event");
    return;
  }

  const response = await context.http.post({
    url: `${backendUrl.replace(/\/$/, "")}/api/triggers/roundups/process-user`,
    headers: {
      Authorization: [`Bearer ${triggerSecret}`],
      "Content-Type": ["application/json"]
    },
    body: JSON.stringify({
      email,
      batchId: `atlas_${changeEvent._id?._data || Date.now()}`
    })
  });

  console.log(`Charitap trigger response: ${response.statusCode}`);
  return response;
};
