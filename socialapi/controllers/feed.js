const expressValidator = require("express-validator");

const io = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");
const { clearImage } = require("../util/file");

exports.getPosts = async (req, res, next) => {
  // Pagination variables
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .populate("creator")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: "Fetched posts successfully.",
      posts: posts,
      totalItems: totalItems
    });
  } catch (error) {
    next(error);
  }
};

exports.createPost = async (req, res, next) => {
  const errors = expressValidator.validationResult(req);
  // Validation error
  if (!errors.isEmpty()) {
    const error = new Error(
      "Validation failed, data that was entered is incorrect"
    );
    error.statusCode = 422;
    throw error;
  }

  // No image file provided error
  if (!req.file) {
    const error = new Error("No image provided.");
    error.statusCode = 422;
    throw error;
  }

  // Need to change the path from \\ to / due to windows
  const imageUrl = req.file.path.replace("\\", "/");

  const title = req.body.title;
  const content = req.body.content;
  const post = new Post({
    title: title,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId
  });

  try {
    await post.save();
    const user = await User.findById(req.userId);
    user.posts.push(post);
    await user.save();

    // inform all connected clients
    io.getIO().emit("posts", {
      action: "create",
      post: { ...post._doc, creator: { _id: req.userId, name: user.name } }
    });

    res.status(201).json({
      message: "Post created successfully!",
      post: post,
      creator: { _id: user._id, name: user.name }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);

    // Couldn't find the post
    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404;
      throw error;
    }

    // Found the post
    res.status(200).json({ message: "Post fetched.", post: post });
  } catch (error) {
    next(error);
  }
};

exports.updatePost = async (req, res, next) => {
  const errors = expressValidator.validationResult(req);
  // Validation error
  if (!errors.isEmpty()) {
    const error = new Error(
      "Validation failed, data that was entered is incorrect"
    );
    error.statusCode = 422;
    throw error;
  }

  const postId = req.params.postId;
  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;
  if (req.file) {
    imageUrl = req.file.path;
  }

  // Need to change the path from \\ to / due to windows
  imageUrl = imageUrl.replace("\\", "/");
  if (!imageUrl) {
    const error = new Error("No file picked.");
    error.statusCode = 422;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate("creator");

    // Couldn't find the post
    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404;
      throw error;
    }

    // Post wasn't created by the user trying to edit it
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not authorized");
      error.statusCode = 403;
      throw error;
    }

    // Clear the image from the server if they included a new image in the edit
    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }
    post.title = title;
    post.imageUrl = imageUrl;
    post.content = content;
    const result = await post.save();

    io.getIO().emit("posts", { action: "update", post: result });
    res.status(200).json({ message: "Post updated!", post: result });
  } catch (error) {
    next(error);
  }
};

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;
  const userId = req.userId;
  try {
    const post = await Post.findById(postId);

    // Couldn't find post the post
    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404;
      throw error;
    }

    // Post wasn't created by the user trying to delete it
    if (post.creator.toString() !== userId) {
      const error = new Error("Not authorized.");
      error.statusCode = 403;
      throw error;
    }

    // Delete the image file and the post
    clearImage(post.imageUrl);
    await Post.findByIdAndRemove(postId);

    // Remove the post from the users posts
    const user = await User.findById(userId);
    user.posts.pull(postId);
    await user.save();

    io.getIO().emit("posts", { action: "delete", post: postId });
    res.status(200).json({ message: "Successfully deleted post." });
  } catch (error) {
    next(error);
  }
};
