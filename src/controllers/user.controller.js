import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import {User} from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import {ApiResponse} from '../utils/ApiResponse.js';
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
   try {
      const user = await User.findById(userId)
      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()

      user.refreshToken = refreshToken
      user.save({validateBeforeSave : false})

      return {accessToken, refreshToken}

   } catch (error) {
      throw new ApiError(500, "Something went wrong while genrating access and refresh token")
   }
}


const registerUser = asyncHandler(async (req, res) => {
   //get user detail from frontend
   //validation-not empty
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

const loginUser  = asyncHandler(async (req, res) => {
   //req body -> data from frontend
   //validation -> non empty .. username or email
   // check if user exists
   //check password
   // generate tokens access and refresh
   // send cookie and return response

   const {email, username, password} = req.body

   if(!username && !email)
      throw new ApiError(400, "Username or Email is required");

   const user = await User.findOne({
      $or: [{email}, {username}]
   })


   if(!user) {
      throw new ApiError(404, "User not found");
   }

   const isPasswordValid = await user.isPasswordCorrect(password)

   if(!isPasswordValid) {
      throw new ApiError(401, "Password is not valid");
   }

   const {accessToken , refreshToken} = await generateAccessAndRefreshTokens(user._id)

   

   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

   //cookies
   const options = {
      httpOnly: true,
      secure: true
   }

   return res
   .status(200)
   .cookie("accessToken",accessToken, options)
   .cookie("refreshToken",refreshToken, options)
   .json(
      new ApiResponse(
         200,
         {
            user: loggedInUser, accessToken, refreshToken
         },
         "User logged in Successfully"
      )
   )

})

const logoutUser = asyncHandler(async(req, res) => {
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            refreshToken : undefined
         }
      },
      {
         new: true
      }
   )

   const options= {
      httpOnly: true,
      secure: true
   }
   return res
   .status(200)
   .clearCookie("accessToken",options)
   .clearCookie("refreshToken",options)
   .json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async (req, res)=>{
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
   //video made error here below (!) was not there
   if(!incomingRefreshToken){
      throw new ApiError(401,"Unauthorized Request")
   }

   try {
      const decodedToken = jwt.verify(
         incomingRefreshToken, 
         process.env.REFRESH_TOKEN_SECRET
      )
   
      const user = await User.findById(decodedToken?._id)
   
      if(!user){
         throw new ApiError(401,"Unauthorized Invalid refresh token")
      }
   
      if(incomingRefreshToken !== user?.refreshToken){
         throw new ApiError(401,"Refresh token is expired or used")
      }
   
      const options = {
         httpOnly : true,
         secure : true
      }
      const {accessToken,new_refreshToken} = await generateAccessAndRefreshTokens(user._id)
   
      return res 
      .status(200)
      .cookie("accessToken",accessToken,options)
      .cookie("refreshToken",new_refreshToken,options)
      .json(
         new ApiResponse(
            200,
            {accessToken, refreshToken: new_refreshToken},
            "Access Token Refreshed"
         )
      )
   } catch (error) {
      throw new ApiError(401, error?.message || "Invalid Refresh Token")
   }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
   const {oldPassword, newPassword} = req.body

   const user = await User.findById(req.user?._id)

   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

   if(!isPasswordCorrect) {
      throw new ApiError(400,"Incorrect Old Password")
   }

   user.password = newPassword
   await user.save({validateBeforeSave: false})

   return res
   .status(200)
   .json(new ApiResponse(200,{}, "Password changed Successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
   return res
   .status(200)
   .json(200, req.User, "current user fetched successfully")
})

//try to update images separately -advice
const updateAccountDetails = asyncHandler(async(req, res) =>{
   const {fullName, email} = req.body

   if(!fullName || !email){
      throw new ApiError(400, "ALl fields are required")
   }

   const user = await User.findByIdAndUpdate(req.user?._id,
      {
         $set : {
            fullName,
            email:email
         }
      },
      {new:true}
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req, res) => {
   const avatarLocalPath = req.file?.path

   if(!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is missing")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath)

   if(!avatar.url) {
      throw new ApiError(400,"Error while uploading on avatar")
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set:{
            avatr:avatar.url
         }
      },
      {new:true}
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200, user, "Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler(async(req, res) => {
   const coverImageLocalPath = req.file?.path

   if(!coverImageLocalPath) {
      throw new ApiError(400, "Cover Image file is missing")
   }

   const coverImage = await uploadOnCloudinary(coverImageLocalPath)

   if(!coverImage.url) {
      throw new ApiError(400,"Error while uploading on cover image")
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set:{
            coverImage:coverImage.url
         }
      },
      {new:true}
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200,user, "Cover Image updated successfully"))
})


export {
   registerUser, 
   loginUser,
   logoutUser,
   refreshAccessToken,
   changeCurrentPassword,
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage
}; 