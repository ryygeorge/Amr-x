export async function getMLPrediction(organism, antibiotic) {
  const ML_API_URL = "https://amrx-ml-api.onrender.com/api/v1/predict";

  const response = await fetch(ML_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organism, antibiotic })
  });

  if (!response.ok) {
    throw new Error("ML API failed");
  }

  return await response.json();
}
