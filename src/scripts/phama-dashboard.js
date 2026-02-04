// import { getMLPrediction } from "./ml-predictor.js";
// import { renderMLResult } from "./ml-display.js";

// const predictBtn = document.getElementById("mlPredictBtn");
// const resultBox = document.getElementById("mlResult");

// predictBtn.addEventListener("click", async () => {
//   const organism = document.getElementById("mlOrganism").value;
//   const antibiotic = document.getElementById("mlAntibiotic").value;

//   if (!organism || !antibiotic) {
//     alert("Select organism and antibiotic");
//     return;
//   }

//   resultBox.innerHTML = "<p>Running ML model…</p>";

//   try {
//     const prediction = await getMLPrediction(organism, antibiotic);
//     renderMLResult(resultBox, prediction);
//   } catch (err) {
//     resultBox.innerHTML = `
//       <p style="color:#ef4444">
//         ML service unavailable. Try again later.
//       </p>
//     `;
//   }
// });