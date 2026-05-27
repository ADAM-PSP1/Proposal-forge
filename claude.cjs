exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY environment variable is not set." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  body.stream = false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.text();
    clearTimeout(timeout);

    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json" },
      body: data,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      return {
        statusCode: 504,
        body: JSON.stringify({ error: "Request timed out. Try shorter meeting notes or fewer focus areas." }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
