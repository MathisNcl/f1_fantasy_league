import nodemailer from "nodemailer";

// Transporter Gmail — utilise les App Passwords (2FA requis)
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,   // ex. f1fantasy.league@gmail.com
    pass: process.env.GMAIL_APP_PASSWORD, // App Password depuis myaccount.google.com
  },
});
