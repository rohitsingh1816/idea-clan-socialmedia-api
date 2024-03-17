const User = require("../models/user");
const JWT_SECRET = require("../api-keys/api-keys").JWT_SECRET;

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const expressValidator = require("express-validator");

exports.signup = async (req, res, next) => {
  const errors = expressValidator.validationResult(req);

  // Validation error
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed.");
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

  const email = req.body.email;
  const name = req.body.name;
  const password = req.body.password;

  try {
    const hashedPw = await bcrypt.hash(password, 12);

    // Only store the hashed password in the database
    const user = new User({
      email: email,
      password: hashedPw,
      name: name
    });
    const result = await user.save();

    res.status(201).json({ message: "User created!", userId: result._id });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const user = await User.findOne({ email: email });

    // Couldn't find the user
    if (!user) {
      const error = new Error("No account with this email exists.");
      error.statusCode = 401;
      throw error;
    }

    const isEqual = await bcrypt.compare(password, user.password);

    // Password didn't match
    if (!isEqual) {
      const error = new Error("Incorrect password.");
      error.statusCode = 401;
      throw error;
    }

    // Credentials are valid, generate a JSON Web Token
    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id.toString()
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    return res.status(200).json({ token: token, userId: user._id.toString() });
  } catch (error) {
    next(error);
  }
};

exports.getUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    // Couldn't find the user
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({ status: user.status });
  } catch (error) {
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  const newStatus = req.body.status;
  try {
    const user = await User.findById(req.userId);

    // Couldn't find the user
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = 404;
      throw error;
    }

    user.status = newStatus;
    await user.save();

    res.status(200).json({ message: "User updated." });
  } catch (error) {
    next(error);
  }
};
