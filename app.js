require("dotenv").config();
const express = require("express");
const app = express();
const port = 3000;
const { IgApiClient } = require("instagram-private-api");
const mongoose = require("mongoose");
const session = require("express-session");
const {instagramIdToUrlSegment, urlSegmentToInstagramId} = require('instagram-id-to-url-segment');
const e = require("express");
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
    // Assuming ig is an Instagram private API instance
    ig.state.generateDevice(req.body.username);
    const result = await ig.account.login(req.body.username, req.body.password);
    
    req.session.user = result;
    console.log(result);

    const user = await User.findOne({ username: req.body.username });

    if (user) {
      res.cookie("username", result.username);
      return res.redirect("/");
    }

    // If the user does not exist, create a new user
    await User.create({
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
  } catch (error) {
    res.status(401).render("login", { error: error.message });
  }
});
app.post("/add-like", async (req, res) => {
  try {
    const users = await User.find();

    // Iterate over each user
    for (const user of users) {
      ig.state.generateDevice(user.username); // Use user-specific device info
      
      // Try to log in with the current user's credentials
      try {
        const loggedInUser = await ig.account.login(user.username, user.password);

        // If login is successful, proceed with the like action
        const code = extractMediaIdFromUrl(req.body.url); // Assuming URL is sent in the request body
        const mediaId = urlSegmentToInstagramId(code);

        const result = await ig.media.like({
          mediaId: mediaId,
          moduleInfo: {
            module_name: 'profile',
            user_id: loggedInUser.pk,
            username: loggedInUser.username,
          },
        });

        console.log(`Liked by user: ${user.username}`);
        console.log(result);

   

      } catch (loginError) {
        // Handle login errors if needed (e.g., continue to the next user)
        console.log(`Login failed for user: ${user.username}`);
        console.error(loginError);
        continue; // Skip to the next user if login fails
      }
    }

    res.redirect("/get-like"); // Render the home page or handle other responses based on your requirements

  } catch (error) {
    // Handle other errors appropriately
    res.status(500).render("error", { error: error.message });
  }
});
app.get("/get-like",async(req,res)=>{
  
  res.render("send-like");
})

function extractMediaIdFromUrl(url) {
  // The URL pattern typically looks like this: https://www.instagram.com/p/{media-id}/
  const match = url.match(/\/p\/([^/]+)/);
  return match ? match[1] : null;
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

