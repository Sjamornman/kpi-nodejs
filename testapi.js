const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5010;

// Enable CORS
app.use(cors());

// Sample endpoint
app.get("/api", (req, res) => {
  res.json([{ count_a: 7, count_b: 2 }]);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
