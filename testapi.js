const bodyParser = require("body-parser");
const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

// Load SSL certificate and key
const options = {
  key: fs.readFileSync("private-key.pem"), 
  cert: fs.readFileSync("certificate.pem"), 
};

app.use(bodyParser.json(), cors());

app.get("/", (req, res) => {
  res.send("Welcome to the test API");
});

app.get("/api", (req, res) => {
  res.json([{ count_a: 7, count_b: 2 }]);
});

// Create HTTPS server
https.createServer(options, app).listen(PORT, () => {
  console.log(`HTTPS Server is running on port ${PORT}`);
});
