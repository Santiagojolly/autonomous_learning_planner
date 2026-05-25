// @ts-nocheck
import { join } from "https://deno.land/std@0.182.0/path/mod.ts";

const KV_FILE = join(Deno.cwd(), "kv_store.json");

async function readKV() {
  try {
    const text = await Deno.readTextFile(KV_FILE);
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function writeKV(data: any) {
  await Deno.writeTextFile(KV_FILE, JSON.stringify(data, null, 2));
}

export const set = async (key, value) => {
  try {
    const data = await readKV();
    data[key] = value;
    await writeKV(data);
  } catch (err) {
    console.error("Critical error in kv.set:", err.message);
    throw err;
  }
};

export const get = async (key) => {
  try {
    const data = await readKV();
    return data[key];
  } catch (err) {
    console.error("Critical error in kv.get:", err.message);
    return null;
  }
};

export const del = async (key) => {
  try {
    const data = await readKV();
    delete data[key];
    await writeKV(data);
  } catch (err) {
    console.error("Critical error in kv.del:", err.message);
  }
};