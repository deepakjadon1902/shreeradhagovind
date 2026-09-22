import { Router, Request, Response } from "express";
import { generateLlmsTxt, generateLlmsFullTxt } from "../services/llms/llmsGenerator";

const r = Router();

const sendTextResponse = (res: Response, content: string) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.status(200).send(content);
};

const handleLlms = async (req: Request, res: Response) => {
  try {
    const forceFresh = req.query.fresh === "true";
    const content = await generateLlmsTxt({ forceFresh });
    sendTextResponse(res, content);
  } catch (error) {
    console.error("[llms.txt] Error generating llms.txt:", error);
    res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8").send(
      "# Shri Radha Govind Store\n\n> Shri Radha Govind Store is a devotional and spiritual e-commerce store based in Vrindavan, Uttar Pradesh, India.\n\nDatabase service is currently unavailable. Please visit https://www.shriradhagovindstore.com/ for up-to-date store information."
    );
  }
};

const handleLlmsFull = async (req: Request, res: Response) => {
  try {
    const forceFresh = req.query.fresh === "true";
    const content = await generateLlmsFullTxt({ forceFresh });
    sendTextResponse(res, content);
  } catch (error) {
    console.error("[llms-full.txt] Error generating llms-full.txt:", error);
    res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8").send(
      "# Shri Radha Govind Store\n\n> Shri Radha Govind Store is a devotional and spiritual e-commerce store based in Vrindavan, Uttar Pradesh, India.\n\nDatabase service is currently unavailable. Please visit https://www.shriradhagovindstore.com/ for up-to-date store information."
    );
  }
};

r.get("/llms.txt", handleLlms);
r.get("/llms-full.txt", handleLlmsFull);
r.get("/api/llms.txt", handleLlms);
r.get("/api/llms-full.txt", handleLlmsFull);

export default r;
