const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const cors = require("cors");
const crypto = require("crypto");
const session = require("express-session");

const os = require("os");

const app = express();
const port = process.env.PORT || 3000;

function getLocalIpAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (const interface in networkInterfaces) {
    for (const addr of networkInterfaces[interface]) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return "127.0.0.1"; // Fallback
}

const ipAddresses = getLocalIpAddress();
const allowedOrigin = `http://${ipAddresses}:9005`;
const allowedOrigins = [allowedOrigin /*`http://${ipAddresses}`*/];

app.use(cors());

app.use(
  session({
    secret: "xyz123abc987", // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true, // Mitigate XSS
      secure: process.env.NODE_ENV === "production", // Set to true if using HTTPS
      expires: null, // This will make the cookie expire when the browser is closed
    },
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  //console.log(`Request received: ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// MySQL connection pool
const local = mysql.createPool({
  connectionLimit: 10,
  host: "13.212.195.146",
  user: "kpi",
  password: "Kpi@10706",
  database: "kpi",
});

const localPool = local.promise();

function checkAuthentication(req, res, next) {
  //console.log("Session on authentication check:", req.session);
  if (req.session.authenticated) {
    next(); // Proceed to the next middleware/route handler
  } else {
    res.status(401).json({
      authenticated: false,
      redirectUrl: "https://it.nkh.go.th/kpi",
    });
  }
}

function hashPassword(password) {
  // First, create a SHA-1 hash of the password
  const sha1Hash = crypto.createHash("sha1").update(password).digest("hex");

  // Then, create an MD5 hash of the SHA-1 hash
  const md5Hash = crypto.createHash("md5").update(sha1Hash).digest("hex");

  return md5Hash; // Return the final MD5 hash
}

// Login endpoint
/*
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === process.env.USERNAMES && password === process.env.PASSWORD) {
    req.session.authenticated = true; // Set authentication flag in session
    //console.log("Session set:", req.session); // Log the entire session
    return res.redirect('https://it.nkh.go.th/kpi'); // Adjust redirect as necessary
  }

  return res.status(401).send("Unauthorized");
});
*/

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const hashedPassword = hashPassword(password);
  //console.log(hashedPassword);
  try {
    const [user] = await localPool.query(
      `SELECT td.dep_code, td.dep_name_short, td.dep_name_th FROM tb_user tu left join tb_department td on tu.user_name = td.dep_name_short WHERE tu.user_name = '${username}' and tu.user_password = '${hashedPassword}'`
    );

    if (user.length === 0) {
      res.redirect("https://it.nkh.go.th/kpi");
    } else {
      req.session.authenticated = true;
      req.session.user_dep_code = user[0].dep_code;
      req.session.user_dep_name = user[0].dep_name_th;
      //console.log(req.session.user_dep_code);
      res.redirect("https://it.nkh.go.th/kpi");
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Session check endpoint
app.get("/check-session", (req, res) => {
  // Uncomment this line for debugging session details
  // console.log("Session on check:", req.session);

  if (req.session.authenticated) {
    return res.json({
      authenticated: true,
      redirectUrl: "https://it.nkh.go.th/kpi",
      user_dep_code: req.session.user_dep_code,
      user_dep_name: req.session.user_dep_name,
    });
  } else {
    return res.json({
      authenticated: false,
      redirectUrl: "https://it.nkh.go.th/kpi/login.html",
      user_dep_code: req.session.user_dep_code,
      user_dep_name: req.session.user_dep_name,
    });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Could not log out." });
    }
    res.clearCookie("connect.sid"); // Clear the session cookie
    res.json({ message: "Logged out successfully." });
  });
});

app.get("/kpi/:user_dep/:score_date", checkAuthentication, async (req, res) => {
  const user_dep = req.params.user_dep;
  const score_date = req.params.score_date;

  try {
    const [result] = await localPool.query(
      `SELECT tt.kpi_code, tt.temp_code,tt.temp_name, tt.temp_type_a, temp_type_b, ts.temp_score_a , ts.temp_score_b, td.temp_a_detail, td.temp_b_detail
      FROM tb_kpi_template tt
      LEFT OUTER JOIN tb_kpi_template_detail td on tt.temp_code = td.temp_code
      LEFT JOIN tb_score ts on tt.temp_code = ts.temp_code and ( ts.user_dep = '${user_dep}') and ts.score_date = '${score_date}' 
      WHERE  
      FIND_IN_SET('${user_dep}', tt.temp_type_a) > 0 OR 
      FIND_IN_SET('${user_dep}', tt.temp_type_b) > 0
      ORDER BY tt.kpi_code, tt.temp_code,tt.temp_name
      /*(${user_dep} in (tt.temp_type_a) or ${user_dep} in (tt.temp_type_b))*/  `
    );
    res.json(result);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get(
  "/kpicount/:user_dep/:score_date",
  checkAuthentication,
  async (req, res) => {
    const user_dep = req.params.user_dep;
    const score_date = req.params.score_date;

    try {
      const [result] = await localPool.query(
        `SELECT 
        COUNT(IF(FIND_IN_SET('${user_dep}', a.temp_type_a) > 0 and a.temp_score_a is null, 1, NULL)) AS count_a,
        COUNT(IF(FIND_IN_SET('${user_dep}', a.temp_type_b) > 0 and a.temp_score_b is null, 1, NULL)) AS count_b
        FROM
        (			
            SELECT 
                tt.kpi_code, 
                tt.temp_code,
                tt.temp_name, 
                tt.temp_type_a, 
                tt.temp_type_b, 
                ts.temp_score_a, 
                ts.temp_score_b 
            FROM 
                tb_kpi_template tt
            LEFT JOIN 
                tb_score ts ON tt.temp_code = ts.temp_code 
                AND ts.user_dep = '${user_dep}' 
                AND ts.score_date = '${score_date}' 
            WHERE 
                (tt.temp_type_a LIKE '%${user_dep}%' OR tt.temp_type_b LIKE '%${user_dep}%')
        ) AS a`
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.get("/get-user", async (req, res) => {
  try {
    const [result] = await localPool.query(
      `SELECT *
        
        FROM tb_department
        `
    );
    res.json(result);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/submit", async (req, res) => {
  const data = req.body;
  console.log("Received form data:", data);

  const curdate = new Date().toISOString().split("T")[0];
  const baseScore = curdate.replace(/-/g, "");
  console.log(baseScore);
  const scoreNumber = await getNextScoreNumber(baseScore);

  try {
    const insertedRecords = [];

    for (const item of data) {
      const { score_date, kpi_code, temp_code, score_a, score_b, user_dep } =
        item;

      const [existingRecord] = await localPool.query(
        "SELECT * FROM tb_score WHERE kpi_code = ? AND temp_code = ? AND score_date = ? AND user_dep = ?",
        [kpi_code, temp_code, score_date, user_dep]
      );

      if (existingRecord.length === 0) {
        if (score_a === "" && score_b !== "") {
          await localPool.query(
            `INSERT INTO tb_score (score_date, score_number, kpi_code, temp_code, temp_score_b, user_dep) VALUES (?, ?, ?, ?, ?, ?)`,
            [score_date, scoreNumber, kpi_code, temp_code, score_b, user_dep]
          );
        } else if (score_a !== "" && score_b === "") {
          await localPool.query(
            `INSERT INTO tb_score (score_date, score_number, kpi_code, temp_code, temp_score_a, user_dep) VALUES (?, ?, ?, ?, ?, ?)`,
            [score_date, scoreNumber, kpi_code, temp_code, score_a, user_dep]
          );
        } else if (score_a !== "" && score_b !== "") {
          await localPool.query(
            `INSERT INTO tb_score (score_date, score_number, kpi_code, temp_code, temp_score_a, temp_score_b, user_dep) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              score_date,
              scoreNumber,
              kpi_code,
              temp_code,
              score_a,
              score_b,
              user_dep,
            ]
          );
        }
      } else {
        if (score_a === "" && score_b !== "") {
          await localPool.query(
            "UPDATE tb_score SET temp_score_b = ?, temp_score_a = null WHERE kpi_code = ? AND score_date = ? AND temp_code = ? AND user_dep = ?",
            [score_b, kpi_code, score_date, temp_code, user_dep]
          );
          console.log(
            `Updated: ${kpi_code}, ${temp_code}, ${score_date}, temp_score_a: ${score_a}, temp_score_b: ${score_b}, user_dep: ${user_dep}`
          );
        } else if (score_a !== "" && score_b === "") {
          console.log("test");
          await localPool.query(
            "UPDATE tb_score SET temp_score_a = ?, temp_score_b = null WHERE kpi_code = ? AND score_date = ? AND temp_code = ? AND user_dep = ?",
            [score_a, kpi_code, score_date, temp_code, user_dep]
          );
          console.log(
            `Updated: ${kpi_code}, ${temp_code}, ${score_date}, temp_score_a: ${score_a}, temp_score_b: ${score_b}, user_dep: ${user_dep}`
          );
        } else if (score_a !== "" && score_b !== "") {
          await localPool.query(
            "UPDATE tb_score SET temp_score_a = ?, temp_score_b = ? WHERE kpi_code = ? AND score_date = ? AND temp_code = ? AND user_dep = ?",
            [score_a, score_b, kpi_code, score_date, temp_code, user_dep]
          );
          console.log(
            `Updated: ${kpi_code}, ${temp_code}, ${score_date}, temp_score_a: ${score_a}, temp_score_b: ${score_b}, user_dep: ${user_dep}`
          );
        } else if (score_a == "" && score_b == "") {
          await localPool.query(
            "UPDATE tb_score SET temp_score_a = null, temp_score_b = null WHERE kpi_code = ? AND score_date = ? AND temp_code = ? AND user_dep = ?",
            [kpi_code, score_date, temp_code, user_dep]
          );
        }
      }

      insertedRecords.push({
        score_number: scoreNumber,
        kpi_code,
        temp_code,
        score_a,
        score_b,
      });
    }

    res
      .status(200)
      .json({ message: "Data inserted successfully", insertedRecords });
  } catch (error) {
    console.error("Error processing submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getNextScoreNumber(base) {
  const [rows] = await localPool.query(
    `SELECT score_number FROM tb_score WHERE score_number LIKE ? ORDER BY score_number DESC LIMIT 1`,
    [`${base}S%`]
  );

  if (rows.length > 0) {
    const lastScore = rows[0].score_number;
    const lastNumber = parseInt(lastScore.slice(-6)) + 1; // Extract and increment the last number
    const nextNumber = `${base}S${String(lastNumber).padStart(6, "0")}`; // Format with leading zeros
    return nextNumber;
  }

  return `${base}S000001`;
}

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
