import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { generateToken } from "../utils/jwt.utils";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

export const signUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    // Validasi input
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
    }

    // Cek jika user sudah ada
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Buat user baru
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // Generate token
    const token = generateToken(user.user_id);

    // Response minimal tanpa data sensitif
    res.cookie("auth_token", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 6 * 60 * 60 * 1000, // 6 jam
    });

    res.status(200).json({
      success: true,
      message: "Authentication successful",
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const signIn = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    // Validasi input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Cari user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verifikasi password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken(user.user_id);

    // Response minimal tanpa data sensitif
    res.cookie("auth_token", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 6 * 60 * 60 * 1000, // 6 jam
    });

    return res.status(200).json({
      success: true,
      message: "Authentication successful",
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
