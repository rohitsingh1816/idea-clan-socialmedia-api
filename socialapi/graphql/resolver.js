const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const JWT_SECRET = require("../api-keys/api-keys").JWT_SECRET;

const User = require("../models/user");
const Post = require("../models/post");
const { clearImage } = require("../util/file");

module.exports = {
  createUser: async function({ userInput }, req) {
    // const email = args.userInput.email;
    const errors = [];

    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: "Email is invalid." });
    }

    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: "Password too short" });
    }

    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error("User already exists!");
      throw error;
    }

    const hashedPw = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPw
    });

    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },
  login: async function({ email, password }) {
    const user = await User.findOne({ email: email });
    handleNoUser(user);

    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error("Password is incorrect.");
      error.code = 401;
      throw error;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return { token: token, userId: user._id.toString() };
  },
  createPost: async function({ postInput }, req) {
    handleAuth(req);
    handlePostErrors(validator, postInput);

    const user = await User.findById(req.userId);
    handleNoUser(user);

    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user
    });

    // Add post to the users posts
    const createdPost = await post.save();
    user.posts.push(createdPost);
    await user.save();

    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString()
    };
  },
  posts: async function({ page }, req) {
    handleAuth(req);

    if (!page) {
      page = 1;
    }

    const perPage = 2;

    const totalPosts = await Post.find().countDocuments();
    // serverside pagination
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate("creator");

    return {
      posts: posts.map(post => {
        return {
          ...post._doc,
          _id: post._id.toString(),
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString()
        };
      }),
      totalPosts: totalPosts
    };
  },
  post: async function({ id }, req) {
    handleAuth(req);
    const post = await Post.findById(id).populate("creator");
    handleNoPost(post);
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString()
    };
  },
  updatePost: async function({ id, postInput }, req) {
    handleAuth(req);
    const post = await Post.findById(id).populate("creator");
    handleNoPost(post);
    handleUserPermissions(post, req);
    handlePostErrors(validator, postInput);

    post.title = postInput.title;
    post.content = postInput.content;
    if (postInput.imageUrl !== "undefined") {
      post.imageUrl = postInput.imageUrl;
    }

    const updatedPost = await post.save();
    return {
      _id: updatedPost._id.toString(),
      ...updatedPost._doc,
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString()
    };
  },
  deletePost: async function({ id }, req) {
    handleAuth(req);
    const post = await Post.findById(id);
    handleNoPost(post);
    handleUserPermissions(post, req);
    clearImage(post.imageUrl);
    await Post.findByIdAndRemove(id);
    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();
    return true;
  },
  user: async function(args, req) {
    handleAuth(req);
    const user = await User.findById(req.userId);
    handleNoUser(user);

    return { ...user._doc, _id: user._id.toString() };
  },
  updateStatus: async function({ status }, req) {
    handleAuth(req);
    const user = await User.findById(req.userId);
    handleNoUser(user);
    user.status = status;
    await user.save();
    return { ...user._doc, _id: user._id.toString() };
  }
};

function handleAuth(req) {
  if (!req.isAuth) {
    const error = new Error("User not authenticated!");
    error.code = 401;
    throw error;
  }
}

function handleNoPost(post) {
  if (!post) {
    const error = new Error("No post was found!");
    error.code = 404;
    throw error;
  }
}

function handleNoUser(user) {
  if (!user) {
    const error = new Error("Invalid user.");
    error.data = errors;
    error.code = 401;
    throw error;
  }
}

function handleUserPermissions(post, req) {
  let postCreatorId = post.creator;
  if (post.creator && post.creator._id) {
    postCreatorId = post.creator._id;
  }

  if (postCreatorId.toString() !== req.userId.toString()) {
    const error = new Error("Not authorised to edit!");
    error.code = 403;
    throw error;
  }
}

function handlePostErrors(validator, postInput) {
  const errors = [];
  if (
    validator.isEmpty(postInput.title) ||
    !validator.isLength(postInput.title, { min: 5 })
  ) {
    errors.push({ message: "Title is invalid." });
  }

  if (
    validator.isEmpty(postInput.content) ||
    !validator.isLength(postInput.content, { min: 5 })
  ) {
    errors.push({ message: "Content is invalid." });
  }

  // Do have errors
  if (errors.length > 0) {
    const error = new Error("Invalid input.");
    error.data = errors;
    error.code = 422;
    throw error;
  }
}
