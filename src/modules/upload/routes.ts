import { Router } from "express";
import { z } from "zod";
import { uploadAdminImage } from "../../services/backblazeService.js";

export const uploadRouter = Router();

const uploadBodySchema = z.object({
  dataUri: z.string().min(10),
  filename: z.string().optional(),
});

uploadRouter.post("/", async (req, res, next) => {
  try {
    const parsed = uploadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    const { dataUri, filename } = parsed.data;

    const match = dataUri.match(/^data:([a-zA-Z0-9+/]+\/[a-zA-Z0-9+/]+);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ success: false, error: "dataUri invalide (format attendu: data:<mime>;base64,<data>)" });
      return;
    }

    const mime = match[1];
    const base64Data = match[2];
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
    const name = filename
      ? filename.replace(/[^a-zA-Z0-9._-]/g, "_")
      : `upload_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const buffer = Buffer.from(base64Data, "base64");
    const url = await uploadAdminImage(buffer, name, mime);

    res.status(201).json({ success: true, data: { url } });
  } catch (e) {
    next(e);
  }
});
