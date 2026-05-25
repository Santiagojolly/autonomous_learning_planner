// @ts-nocheck
import { join } from "https://deno.land/std@0.182.0/path/mod.ts";

const USERS_FILE = join(Deno.cwd(), "users_store.json");

async function readUsers() {
  try {
    const text = await Deno.readTextFile(USERS_FILE);
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function writeUsers(data: any) {
  await Deno.writeTextFile(USERS_FILE, JSON.stringify(data, null, 2));
}

export async function signUp(email: string, password: string, name: string) {
  try {
    const users = await readUsers();
    if (users.find((u: any) => u.email === email)) {
      throw new Error("User already exists");
    }
    const newUser = { id: `user_${Math.random().toString(36).substr(2, 9)}`, email, password, name };
    users.push(newUser);
    await writeUsers(users);
    
    return {
      user: { id: newUser.id, email, user_metadata: { name } },
      session: { 
        access_token: `mock_token_${newUser.id}`, 
        refresh_token: "mock_refresh_token" 
      }
    };
  } catch (err) {
    throw new Error(`Sign up error: ${err.message}`);
  }
}

export async function signIn(email: string, password: string) {
  try {
    const users = await readUsers();
    const user = users.find((u: any) => u.email === email && u.password === password);
    if (!user) {
      throw new Error("Invalid email or password");
    }
    return {
      user: { id: user.id, email: user.email, user_metadata: { name: user.name } },
      session: { 
        access_token: `mock_token_${user.id}`, 
        refresh_token: "mock_refresh_token" 
      }
    };
  } catch (err) {
    throw new Error(`Sign in error: ${err.message}`);
  }
}

export async function verifyToken(token: string) {
  try {
    if (!token.startsWith("mock_token_")) {
      throw new Error("Invalid token format");
    }
    const userId = token.replace("mock_token_", "");
    const users = await readUsers();
    const user = users.find((u: any) => u.id === userId);
    if (!user) {
      throw new Error("User not found");
    }
    return { id: user.id, email: user.email, user_metadata: { name: user.name } };
  } catch (err) {
    throw new Error(`Token verification error: ${err.message}`);
  }
}
