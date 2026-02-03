export function renderMLResult(container, data) {
  const percent = (data.probability * 100).toFixed(1);
  const color =
    data.risk_level === "high" ? "#ef4444" :
    data.risk_level === "moderate-high" ? "#f59e0b" :
    "#10b981";

  container.innerHTML = `
    <div style="text-align:center">
      <h2 style="color:${color}">${percent}%</h2>
      <p><strong>Risk:</strong> ${data.risk_level}</p>
      <p><strong>Model:</strong> ${data.model_version}</p>
      <p style="opacity:.7;font-size:.85rem">
        Generated at ${data.timestamp ? new Date(data.timestamp).toLocaleString() : "Just now"}
      </p>
    </div>
  `;
}
