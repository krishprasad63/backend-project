import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import {User} from '../models/User.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import {ApiResponse} from '../utils/ApiResponse.js';




const registerUser = asyncHandler(async (req, res) => {
   //get user detail from frontend
   //validayion-not empty
   // check if user already exists
   // check for images, check for avatars
   // upload them to cloudinary
   // create user object- create entry in db
   // remove password and refresh token from response
   // check for user creation
   //return response
   
   //testing
   /*
   console.log(req.body);
   console.log(req.file);
   console.log(req.files);
*/
   const {fullName, email, username, password} = req.body;
   console.log("email: ",email);

   if(
      [fullName, email, username, password].some((field) => field?.trim() === "")
   ){
      throw new ApiError(400, "All fields are required");
   }

   const existedUser = await User.findOne({
      $or: [{email}, {username}]
   })
   
   if(existedUser){
      throw new ApiError(409, "User already exists");
   }

   const avatarLocalPath = req.files?.avatar?.[0]?.path;
   const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

   if(!avatarLocalPath){
      throw new ApiError(400, "Avatar file is required--");
   }
   //debugging logs
    /*
   console.log("FILES KEYS:", Object.keys(req.files || {}));
   console.log("AVATAR ARRAY:", req.files?.avatar);
   console.log("AVATAR PATH:", req.files?.avatar?.[0]?.path);
*/
   const avatar = await uploadOnCloudinary(avatarLocalPath);
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

   if(!avatar){
      throw new ApiError(400, "Avatar file is required");
   }

   const user = await User.create({
      fullName,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase()
   })

   const createdUser = await User.findById(user._id).select("-password -refreshToken")

   if(!createdUser){
      throw new ApiError(500, "Something went wrong whhile registering user")
   }

   return res.status(201).json(new ApiResponse(200, createdUser, "User registered successfully"))
})


export {registerUser};