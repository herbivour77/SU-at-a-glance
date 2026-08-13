const { entriesStore, categoriesStore, json, isAdmin, genId } = require("./_utils");

async function loadCategory(id) {
  const store = categoriesStore();
  const raw = await store.get(id);
  return raw ? JSON.parse(raw) : null;
}

async function listEntriesFor(categoryId) {
  const store = entriesStore();
  const { blobs } = await store.list();
  const all = await Promise.all(
    blobs.map(async (b) => JSON.parse((await store.get(b.key)) || "null"))
  );
  return all.filter((e) => e && e.categoryId === categoryId);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, {});
  const store = entriesStore();
  const admin = isAdmin(event);

  // ---- GET: list entries for a category ----
  if (event.httpMethod === "GET") {
    const { category, token } = event.queryStringParameters || {};
    if (!category) return json(400, { error: "category is required" });
    const cat = await loadCategory(category);
    if (!cat) return json(404, { error: "Category not found" });
    if (!admin && cat.shareToken !== token) {
      return json(403, { error: "Invalid or missing share link token" });
    }
    const entries = await listEntriesFor(category);
    entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    // ownerToken is only meaningful to the browser that created the entry - always include it,
    // the frontend simply compares against its own local token to decide edit/delete rights.
    return json(200, { entries });
  }

  // ---- POST: add entry ----
  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    const { categoryId, token, pointOfContact, values, ownerToken } = body;
    if (!categoryId) return json(400, { error: "categoryId is required" });
    const cat = await loadCategory(categoryId);
    if (!cat) return json(404, { error: "Category not found" });
    if (!admin && cat.shareToken !== token) {
      return json(403, { error: "Invalid or missing share link token" });
    }
    if (!pointOfContact || !pointOfContact.trim()) {
      return json(400, { error: "Point of contact name is required before an entry can be submitted" });
    }
    if (!ownerToken) return json(400, { error: "ownerToken is required" });

    const id = genId("ent");
    const entry = {
      id,
      categoryId,
      pointOfContact: pointOfContact.trim(),
      values: values || {},
      ownerToken,
      createdAt: new Date().toISOString(),
      viewed: false,
      viewedAt: null
    };
    await store.set(id, JSON.stringify(entry));
    return json(201, { entry });
  }

  // ---- DELETE: remove entry (owner of the entry, or admin) ----
  if (event.httpMethod === "DELETE") {
    const { id, ownerToken } = event.queryStringParameters || {};
    if (!id) return json(400, { error: "id is required" });
    const raw = await store.get(id);
    if (!raw) return json(404, { error: "Entry not found" });
    const entry = JSON.parse(raw);

    if (!admin) {
      if (entry.viewed) {
        return json(403, { error: "This entry has been reviewed by an admin and can no longer be edited or deleted" });
      }
      if (entry.ownerToken !== ownerToken) {
        return json(403, { error: "You can only delete entries you created" });
      }
    }
    await store.delete(id);
    return json(200, { deleted: id });
  }

  // ---- PATCH: admin marks an entry as viewed / un-viewed (grey out) ----
  if (event.httpMethod === "PATCH") {
    if (!admin) return json(401, { error: "Admin password required" });
    const { id } = event.queryStringParameters || {};
    if (!id) return json(400, { error: "id is required" });
    const raw = await store.get(id);
    if (!raw) return json(404, { error: "Entry not found" });
    const entry = JSON.parse(raw);
    const body = JSON.parse(event.body || "{}");
    entry.viewed = body.viewed !== undefined ? !!body.viewed : !entry.viewed;
    entry.viewedAt = entry.viewed ? new Date().toISOString() : null;
    await store.set(id, JSON.stringify(entry));
    return json(200, { entry });
  }

  return json(405, { error: "Method not allowed" });
};
