const bodyOarser = require("body-parser");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyOarser.json(), cors());

app.get("/", (req, res) => {
  res.send("welcome to test api");
});

app.get("/api", (req, res) => {
  res.json([{ count_a: 7, count_b: 2 }]);
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
