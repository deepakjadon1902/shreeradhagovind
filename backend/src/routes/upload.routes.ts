import { Router } from "express";
import streamifier from "streamifier";
import { cloudinary } from "../config/cloudinary";
import { upload } from "../middleware/upload";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();

r.post("/image", requireAuth, requireAdmin, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "shri-radha-govind", resource_type: "image" },
        (err, r) => (err ? reject(err) : resolve(r))
      );
      streamifier.createReadStream(req.file!.buffer).pipe(stream);
    });
    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (e) {
    next(e);
  }
});

export default r;
