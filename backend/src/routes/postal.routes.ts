import { Router } from "express";

const r = Router();

type PostalApiPostOffice = {
  Name: string;
  Description?: string | null;
  BranchType?: string;
  DeliveryStatus?: string;
  Circle?: string;
  District?: string;
  Division?: string;
  Region?: string;
  Block?: string;
  State?: string;
  Country?: string;
  Pincode?: string;
};

type PostalApiResponse = {
  Message?: string;
  Status: "Success" | "Error" | string;
  PostOffice?: PostalApiPostOffice[] | null;
};

/**
 * GET /api/postal/pincode/:pincode
 * Indian Pincode lookup -> Post Offices, District, State
 */
r.get("/pincode/:pincode", async (req, res) => {
  const rawPincode = (req.params.pincode || "").trim();

  // Validate 6 digits
  if (!/^\d{6}$/.test(rawPincode)) {
    return res.status(400).json({
      success: false,
      message: "Pincode must be exactly 6 numeric digits.",
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(rawPincode)}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.json({
        success: false,
        message: "We couldn't find this pincode. You can enter the address manually.",
      });
    }

    const data = (await response.json()) as PostalApiResponse[];

    if (!Array.isArray(data) || data.length === 0) {
      return res.json({
        success: false,
        message: "We couldn't find this pincode. You can enter the address manually.",
      });
    }

    const firstResult = data[0];
    if (firstResult.Status !== "Success" || !Array.isArray(firstResult.PostOffice) || firstResult.PostOffice.length === 0) {
      return res.json({
        success: false,
        message: "We couldn't find this pincode. You can enter the address manually.",
      });
    }

    const postOfficesRaw = firstResult.PostOffice;
    const district = postOfficesRaw.find((po) => po.District && po.District.trim())?.District?.trim() || "";
    const state = postOfficesRaw.find((po) => po.State && po.State.trim())?.State?.trim() || "";

    // Extract unique post office names
    const postOfficeNames = Array.from(
      new Set(
        postOfficesRaw
          .map((po) => (po.Name || "").trim())
          .filter((name) => name.length > 0)
      )
    );

    return res.json({
      success: true,
      pincode: rawPincode,
      district,
      state,
      postOffices: postOfficeNames,
    });
  } catch (error) {
    // Network failure, timeout, or DNS issue: fallback gracefully without breaking checkout
    return res.json({
      success: false,
      message: "We couldn't find this pincode. You can enter the address manually.",
    });
  }
});

export default r;
