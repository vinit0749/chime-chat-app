export async function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "/login";

    throw new Error("Authentication required");
  }

  return response;
}
