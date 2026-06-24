import rateLimit from "express-rate-limit"
export const globallimiter=rateLimit({
  windowMs:5*60*1000,
  max:100,
  message:"Too many requests, please try again later",
  skip: (req) => req.method === "OPTIONS"
})
export const authlimiter=rateLimit({
  windowMs:5*60*1000,
  max:5,
  skip: (req) => req.method === "OPTIONS"
})