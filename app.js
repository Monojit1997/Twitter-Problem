const express = require("express");
const app = express();

app.use(express.json());

const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbpath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};
initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "ssbsdbfiwe", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        const loginUser = `
          SELECT *
          FROM user
          ORDER BY user_id`;
        const loginUserArray = await db.all(loginUser);
        request.username = payload.username;
        request.loginUserArray = loginUserArray;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = `
  SELECT *
  FROM user
  WHERE username = '${username}';
  `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(request.body.password, 10);
      const createUserQuery = `
          INSERT INTO 
            user (name,username,password,gender)
            VALUES('${name}',
                    '${username}',
                    '${hashedPassword}',
                    '${gender}')`;
      const dbResponse = await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
  SELECT *
  FROM user
  WHERE username = '${username}';
  `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const verifyPassword = await bcrypt.compare(password, dbUser.password);
    if (verifyPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "ssbsdbfiwe");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { loginUserArray } = request;
  const getUserTweetsQuery = `
    SELECT username,tweet,date_time AS dateTime
    FROM user
    NATURAL JOIN tweet
    ORDER BY date_time DESC
    LIMIT 4
    ;`;
  const tweetsArray = await db.all(getUserTweetsQuery);
  response.send(tweetsArray);
});
module.exports = app;
