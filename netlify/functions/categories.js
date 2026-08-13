const { categoriesStore, json, isAdmin, genId } = require("./_utils");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, {});

  const store = categoriesStore();

  // ---- GET: list categories ----
  if (event.httpMethod === "GET") {
    const { id, token, diagnose } = event.queryStringParameters || {};

    // Diagnostic mode: confirms the function is deployed and whether the request is
    // being recognised as admin, without exposing the actual password or category data.
    if (diagnose === "1") {
      return json(200, {
        functionDeployed: true,
        receivedAdminHeader: !!(event.headers["x-admin-password"] || event.headers["X-Admin-Password"]),
        recognisedAsAdmin: isAdmin(event),
        adminPasswordEnvVarSet: !!process.env.ADMIN_PASSWORD,
        siteIdEnvVarSet: !!process.env.SITE_ID,
        blobsTokenEnvVarSet: !!process.env.BLOBS_TOKEN,
        timestamp: new Date().toISOString()
      });
    }
    const { blobs } = await store.list();
    const all = await Promise.all(
      blobs.map(async (b) => JSON.parse((await store.get(b.key)) || "null"))
    );
    const categories = all.filter(Boolean);

    // Single category lookup via shareable link (id + token) - used by entry form page
    if (id) {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return json(404, { error: "Category not found" });
      if (!isAdmin(event) && cat.shareToken !== token) {
        return json(403, { error: "Invalid or missing share link token" });
      }
      const { shareToken, ...safeCat } = cat;
      return json(200, { category: isAdmin(event) ? cat : safeCat });
    }

    // Full list only for admin (includes shareToken so admin can copy links)
    if (isAdmin(event)) {
      // Auto-seed the default "Thanksgiving" category the first time an admin loads the panel
      if (categories.length === 0) {
        const seedId = genId("cat");
        const seed = {
          id: seedId,
          name: "Thanksgiving",
          fields: [
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone Number" },
            { key: "email", label: "Email" }
          ],
          shareToken: genId("tok"),
          createdAt: new Date().toISOString()
        };
        await store.set(seedId, JSON.stringify(seed));
        categories.push(seed);
      }
      return json(200, { categories });
    }

    // Non-admin, no id specified: public directory of forms for the homepage.
    // Includes shareToken because the homepage now links directly into each form -
    // these categories are intentionally browsable, not link-only, per current design.
    return json(
      200,
      { categories: categories.map(({ id, name, fields, shareToken }) => ({ id, name, fields, shareToken })) }
    );
  }

  // ---- POST: add category (admin only) ----
  if (event.httpMethod === "POST") {
    if (!isAdmin(event)) return json(401, { error: "Admin password required" });
    const body = JSON.parse(event.body || "{}");
    const { name, fields } = body;
    if (!name || !Array.isArray(fields) || fields.length === 0) {
      return json(400, { error: "name and at least one field are required" });
    }
    const id = genId("cat");
    const category = {
      id,
      name,
      fields, // e.g. [{ key: "phone", label: "Phone Number" }, ...]
      shareToken: genId("tok"),
      createdAt: new Date().toISOString()
    };
    await store.set(id, JSON.stringify(category));
    return json(201, { category });
  }

  // ---- DELETE: remove category (admin only) ----
  if (event.httpMethod === "DELETE") {
    if (!isAdmin(event)) return json(401, { error: "Admin password required" });
    const { id } = event.queryStringParameters || {};
    if (!id) return json(400, { error: "id is required" });
    await store.delete(id);
    return json(200, { deleted: id });
  }

  return json(405, { error: "Method not allowed" });
};
