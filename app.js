const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const Register = require("./models/register");
const User = require("./models/user");
const app = express();

var bcrypt = require("bcrypt");
var LocalStrategy = require("passport-local").Strategy;
var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
var nodemailer = require("nodemailer");
var crypto = require("crypto");

const path = require("path");
const { json } = require("body-parser");
const saltRounds = 10;
const https = require("https");
const { response } = require("express");
const { workers } = require("cluster");
const passport = require("passport");
const session = require("express-session");


mongoose.set("useFindAndModify", false);

app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));
app.use(express.static("public"));
app.use(express.static(__dirname));

const publicDirectoryPath = path.join(__dirname);

app.set("view engine", "hbs");
app.use(express.static(publicDirectoryPath));

//node mailer account, I borrow my friend account because my account has 2 steps authentication
var transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: "thantqkhai@gmail.com",
    pass: "kylethan1105",
  },
  tls: {
    rejectUnauthorized: true,
  },
});

app.use(
  session({
    resave: true,
    saveUninitialized: false,
    secret: "$$$DeakinSecret",
  })
);

//use passport for authentication
app.use(passport.initialize());
app.use(passport.session());

passport.use(Register.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  Register.findById(id, function (err, user) {
    done(err, user);
  });
});

// authentication for login
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    (email, password, done) => {
      Register.findOne({ email: email }, async function (err, user) {
        if (err) {
          return done(err);
        }
        if (!user) {
          return done(null, false);
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      });
    }
  )
);

//authentication for login by Google account
passport.use(
   new GoogleStrategy(
    {
      clientID:
        "947037627001-49cr4as1of8mv15u1pf7q0g2c19oekar.apps.googleusercontent.com",
      clientSecret: "iNzP7dPrESLMF3pD_7YRfYd0",
      callbackURL: "https://icrowtask.herokuapp.com/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      const newUser = {
        googleId: profile.id,
        username: profile.displayName,
        coutries: "empty",
        fname: profile.displayName,
        lname: profile.displayName,
        email: "email@gmail.com",
        password: "hashPassword",
        address: "address",
        city: "city",
        state: "state",
        zip: "zip",
        mobile: "0123456789",
        password_token: null,
      };

      try {
        let user = await Register.findOne({ googleId: profile.id });
        if (user) {
          console.log(user);
          return done(null, user);
        } else {
          user = await Register.create(newUser);
          console.log(user);
          return done(null, user);
        }
      } catch (err) {
        console.error(err);
        return done(null, false);
      }
    }
  )
);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/success", (req, res) => {
  if (req.isAuthenticated()) {
    res.sendFile(__dirname + "/success.html");
  } else {
    res.redirect("/");
  }
});

app.get("/forgot", (req, res) => {
  res.sendFile(__dirname + "/forgot.html");
});

app.get("/reset/:token", (req, res) => {
  Register.findOne({ password_token: req.params.token }, (err, user) => {
    if (!user) {
      return res.send("Invalid user, we can not find you");
    }

    res.render("reset", {
      token: req.params.token,
    });
  });
});

app.get("/SignUp", (req, res) => {
  res.sendFile(__dirname + "/SignUp.html");
});

//mongodb link access
mongoose.connect(
  "mongodb+srv://dkpham:Bietlamchi3110@dkpham.a80mn.mongodb.net/iCrowdTask?retryWrites=true&w=majority",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  function (req, res) {
    res.redirect("/success");
  }
);

//Login
app.post("/", (req, res) => {
  const email = req.body.Email_signin;
  const password = req.body.password_signin;
  const hashPassword = bcrypt.hashSync(password, saltRounds);
  const register = new Register();
  Register.findOne({ email: email }, async function (err, doc) {
    if (err) {
      res.send("<h1>nah </h1>");
    } else {
      if (doc == null) {
        return res.send("<h1>Invalid User<h1>");
      }
      const isMatch = await bcrypt.compare(password, doc.password);
      if (!isMatch) {
        return res.send("<h1>Invalid Password</h1>");
      }
      res.sendFile(__dirname + "/success.html");
    }
  });
}); 
app.post(
  "/",
  passport.authenticate("local", {
    successRedirect: "/success",
    failureRedirect: "/",
  })
);

//Reset account password

app.post("/forgot", async function (req, res) {
  const email = req.body.email;
  Register.findOne({ email: email }, async (err, user) => {
    if (err) {
      return res.send("<h1>err</h1>");
    } else {
      if (user == null) {
        return res.redirect("/forgot");
      }
      var token = crypto.randomBytes(20).toString("hex");
      Register.findOneAndUpdate(
        { email: email },
        { password_token: token },
        (err) => {
          if (err) {
            return res.send(err);
          }
          var mailOptions = {
            to: email,
            from: "thantqkhai@gmail.com",
            subject: "Sending email to reset your account password",
            text:
              "Please follow this link to reset your password. \n \n" +
              "http://" +
              req.headers.host +
              "/reset/" +
              token,
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.log(error);
              var k;
              // return res.sendFile(__dirname + "/eror404.html");
              return res.send(error);
            } else {
              console.log("Email sent: " + info.response);
              return res.send("Please check your email to reset your password");
            }
          });
        }
      );

      console.log(token);
    }
  });
});

app.post("/reset", (req, res) => {
  const password = req.body.password;
  const cpassword = req.body.cpassword;
  const token = req.body.token;
  const hashPassword = bcrypt.hashSync(password, saltRounds);

  console.log(token);
  try {
    if (password != cpassword) {
      return res.send("<h3> password does not match </h3>");
    }

    Register.findOneAndUpdate(
      { password_token: token },
      { password: hashPassword },
      (err, user) => {
        if (err) {
          return res.send(err);
        }
        if (!user) {
          return res.send("Invalid users");
        }

        return res.redirect("/");
      }
    );
  } catch (error) {
    res.status(500).send(error);
  }
});

//SingUp functiion

app.post("/SignUp", (req, res) => {
  const countries = req.body.countries;
  const firstname = req.body.fname;
  const lastname = req.body.lname;
  const email = req.body.email;
  const password = req.body.password;
  const cpassword = req.body.cpassword;
  const address = req.body.address1 + req.body.address2;
  const city = req.body.city;
  const state = req.body.state;
  const zip = req.body.zip;
  const phone = req.body.phone;
  const hashPassword = bcrypt.hashSync(password, saltRounds);
  const hashCPassword = bcrypt.hashSync(cpassword, saltRounds);

  const data = {
    members: [
      {
        email_address: email,
        status: "subscribed",
        merge_fields: {
          FNAME: firstname,
          LNAME: lastname,
        },
      },
    ],
  };
  
  // mailchimp access 
  jsonData = JSON.stringify(data);
  const api = "0bc59e44507030c7b49675b2007cf214-us17";
  const id_list = "074aa3f87f";
  const url = "https://us17.api.mailchimp.com/3.0/lists/074aa3f87f";
  const option = {
    method: "POST",
    auth: "dkpham:0bc59e44507030c7b49675b2007cf214-us17",
  };

  const request = https.request(url, option, (response) => {
    response.on("data", (data) => {
      console.log(JSON.parse(data));
    });
  });

  request.write(jsonData);
  request.end();

  console.log(firstname, lastname, email);

  const register = new Register({
    googleId: "empty",
    username: firstname,
    coutries: countries,
    fname: firstname,
    lname: lastname,
    email: email,
    password: hashPassword,
    address: address,
    city: city,
    state: state,
    zip: zip,
    mobile: phone,
    password_token: null,
  });
  
  try {
    if (password != cpassword) {
      return res.send("<h3> password does not match </h3>");
    }

    register
      .save()
      .then((register) => {
        if (res.statusCode === 200) {
          res.sendFile(__dirname + "/index.html");
        } else {
          res.sendFile(__dirname + "/eror404.html");
        }
      })
      .catch((err) => {
        res.send("<h3>" + err + "</h3>");
      });
  } catch (error) {
    res.status(500).send(error);
  }
});

//Restful API task worker
app
  .route("/workers")
  .get((req, res) => {
    Register.find((err, workers) => {
      if (!err) {
        res.send(workers);
      } else {
        res.send(err);
      }
    });
  })
  .post((req, res) => {
    const workers = Register(req.body);

    workers
      .save()
      .then(() => {
        res.send(workers);
      })
      .catch((err) => {
        res.status(400).send(err);
      });
  })
  .delete((req, res) => {
    Register.deleteMany((err) => {
      if (err) {
        return res.send(err);
      }
      res.send("Successfully");
    });
  });

app
  .route("/workers/:id")
  .get((req, res) => {
    Register.findById(req.params.id)
      .then((worker) => {
        if (!worker) {
          return res.status(404).send();
        }
        res.send(worker);
      })
      .catch((e) => {
        res.send(e);
      });
  })
  .put((req, res) => {
    Register.findByIdAndUpdate(req.params.id, req.body.password, (err) => {
      if (err) {
        return res.send(err);
      }
      res.send("successful");
    });
  })
  .patch((req, res) => {
    Register.findByIdAndUpdate(
      req.params.id,
      { address: req.body.address, mobile: req.body.mobile },
      (err) => {
        if (err) {
          return res.send(err);
        } else {
          res.send("updated successfully");
        }
      }
    );
  })
  .delete((req, res) => {
    Register.findByIdAndDelete(req.params.id, (err) => {
      if (err) {
        return res.send(err);
      }
      res.send("Successfull");
    });
  });

let port = process.env.PORT;

if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function (request, response) {
  console.log("Server is running in port 3000");
});
