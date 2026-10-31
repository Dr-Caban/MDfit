// Google Places API (New): MD Fit's live Google rating, review count and recent reviews.
// The key lives only in GOOGLE_PLACES_API_KEY on Railway. Docs: https://developers.google.com/maps/documentation/places/web-service
class GoogleError extends Error {}

function createPlaces({ apiKey, baseUrl = "https://places.googleapis.com/v1", fetchImpl = fetch }) {
  const base = baseUrl.replace(/\/+$/, "");
  async function call(method, path, fieldMask, body) {
    if (!apiKey) throw new GoogleError("GOOGLE_PLACES_API_KEY is not set on the server.");
    let res;
    try {
      res = await fetchImpl(base + path, {
        method,
        headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
      });
    } catch (err) {
      throw new GoogleError(`Couldn't reach Google (${err.message}).`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new GoogleError(`Google error ${res.status}: ${data?.error?.message || "request failed"}`);
    return data;
  }

  return {
    enabled: Boolean(apiKey),
    // Text search → the best-matching place id for the business
    async findPlaceId(query) {
      const d = await call("POST", "/places:searchText", "places.id,places.displayName,places.formattedAddress", { textQuery: query, maxResultCount: 1 });
      const p = d.places && d.places[0];
      if (!p) throw new GoogleError(`Google found no place for "${query}".`);
      return { id: p.id, name: p.displayName?.text || "", address: p.formattedAddress || "" };
    },
    async details(placeId) {
      const d = await call("GET", `/places/${encodeURIComponent(placeId)}`, "id,displayName,rating,userRatingCount,googleMapsUri,reviews");
      return {
        placeId: d.id,
        name: d.displayName?.text || "",
        rating: typeof d.rating === "number" ? d.rating : null,
        count: d.userRatingCount || 0,
        url: d.googleMapsUri || "",
        reviews: (d.reviews || []).map((r) => ({
          author: r.authorAttribution?.displayName || "Google user",
          authorUrl: r.authorAttribution?.uri || "",
          photo: r.authorAttribution?.photoUri || "",
          rating: r.rating || 0,
          text: r.text?.text || r.originalText?.text || "",
          relativeTime: r.relativePublishTimeDescription || "",
          publishTime: r.publishTime || ""
        })).filter((r) => r.text)
      };
    }
  };
}

module.exports = { createPlaces, GoogleError };
