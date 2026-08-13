const { getStore } = require("@netlify/blobs");

function categoriesStore() {
  return getStore("categories");
}

function entriesStore() {
  return getStore("entries");
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-password",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function isAdmin(event) {
  const pw = event.headers["x-admin-password"] || event.headers["X-Admin-Password"];
  const expected = process.env.ADMIN_PASSWORD || "Psalm119:105";
  return !!pw && pw === expected;
}

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

module.exports = { categoriesStore, entriesStore, json, isAdmin, genId };
