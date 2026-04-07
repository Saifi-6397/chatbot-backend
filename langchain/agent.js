import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// ── LLM Initialize ──────────────────────────────
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.7,
});

// ── TOOL 1: Search Products ──────────────────────
const searchProductsTool = tool(
  async ({ query }) => {
    try {
      const res = await fetch(
        `https://dummyjson.com/products/search?q=${query}&limit=10`
      );
      const data = await res.json();

      if (!data.products || data.products.length === 0) {
        return "Product not found!";
      }

      return data.products
        .map(p =>
          `ID:${p.id} | ${p.title} | Price:$${p.price} | Rating:${p.rating} | Stock:${p.stock} | Brand:${p.brand} | URL:/products/${p.id}`
        )
        .join("\n");

    } catch (err) {
      return "Error occurred while fetching products!";
    }
  },
  {
    name: "search_products",
    description: "Search products by name or keyword. Use when user asks for any specific product.",
    schema: z.object({
      query: z.string().describe("Search keyword like 'laptop', 'samsung', 'phone'"),
    }),
  }
);

// ── TOOL 2: Filter By Price ──────────────────────
const filterByPriceTool = tool(
  async ({ minPrice, maxPrice }) => {
    try {
      const res = await fetch(
        `https://dummyjson.com/products?limit=0`
      );
      const data = await res.json();

      const filtered = data.products
        .filter(p =>
          p.price >= (minPrice || 0) &&
          p.price <= (maxPrice || 999999)
        )
        .slice(0, 10)
        .map(p =>
          `ID:${p.id} | ${p.title} | Price:$${p.price} | Rating:${p.rating} | Stock:${p.stock} | Brand:${p.brand} | URL:/products/${p.id}`
        )
        .join("\n");

      return filtered || "No products found in this price range!";

    } catch (err) {
      return "Error in price filter!";
    }
  },
  {
    name: "filter_by_price",
    description: "Filter products by price range. Use when user mentions price like '500$ se kam' or 'between 100 and 500'",
    schema: z.object({
      minPrice: z.number().optional().describe("Minimum price e.g. 100"),
      maxPrice: z.number().optional().describe("Maximum price e.g. 500"),
    }),
  }
);

// ── TOOL 3: Get By Category ──────────────────────
const getByCategoryTool = tool(
  async ({ category }) => {
    try {
      const res = await fetch(
        `https://dummyjson.com/products/category/${category}?limit=10`
      );
      const data = await res.json();

      if (!data.products || data.products.length === 0) {
        return "No products found in this category!";
      }

      return data.products
        .map(p =>
          `ID:${p.id} | ${p.title} | Price:$${p.price} | Rating:${p.rating} | Stock:${p.stock} | Brand:${p.brand} | URL:/products/${p.id}`
        )
        .join("\n");

    } catch (err) {
      return "Error on category fetch!";
    }
  },
  {
    name: "get_by_category",
    description: "Get products by category. Use when user asks for specific category like smartphones, laptops, furniture etc.",
    schema: z.object({
      category: z.string().describe("Category name like 'smartphones', 'laptops', 'furniture', 'groceries'"),
    }),
  }
);

// ── TOOL 4: Get Best Rated ───────────────────────
const getBestRatedTool = tool(
  async ({ category }) => {
    try {
      const url = category
        ? `https://dummyjson.com/products/category/${category}?limit=100`
        : `https://dummyjson.com/products?limit=100`;

      const res = await fetch(url);
      const data = await res.json();

      const sorted = data.products
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5)
        .map(p =>
          `ID:${p.id} | ${p.title} | Price:$${p.price} | Rating:${p.rating} | Stock:${p.stock} | Brand:${p.brand} | URL:/products/${p.id}`
        )
        .join("\n");

      return sorted || "No product found!";

    } catch (err) {
      return "Error on product fetching!";
    }
  },
  {
    name: "get_best_rated",
    description: "Get top rated products. Use when user asks for 'best', 'top rated', 'highest rating' products",
    schema: z.object({
      category: z.string().optional().describe("Optional category like 'smartphones', 'laptops'"),
    }),
  }
);

// ── TOOL 5: Get Product Detail ───────────────────
const getProductDetailTool = tool(
  async ({ productId }) => {
    try {
      const res = await fetch(
        `https://dummyjson.com/products/${productId}`
      );
      const p = await res.json();
      return `
        ID:${p.id} | 
        Title:${p.title} | 
        Price:$${p.price} | 
        Rating:${p.rating} | 
        Stock:${p.stock} | 
        Brand:${p.brand} | 
        Availability:${p.availabilityStatus} |
        Return Policy:${p.returnPolicy} |
        Warranty:${p.warrantyInformation} |
        Shipping:${p.shippingInformation} |
        Min Order:${p.minimumOrderQuantity} |
        URL:/products/${p.id}
      `;
    } catch (err) {
      return "Error on fetching product detail!";
    }
  },
  {
    name: "get_product_detail",
    description: "Get complete details of a specific product by its ID including return policy, warranty, shipping info and availability status. Use this when customer asks about return policy, warranty, shipping or any product specific information.",
    schema: z.object({
      productId: z.number().describe("Product ID number e.g. 1, 6, 130"),
    }),
  }
);

// ── TOOL 6: Get Delivery Date 🆕 ─────────────────
const getDeliveryDateTool = tool(
  async ({ city, state, shippingInfo }) => {
    try {
      // Parse shipping days from DummyJSON text
      // "Ships in 1 week" → 7 days
      // "Ships in 3-5 business days" → 5 days
      // "Ships in 1 month" → 30 days

      let shippingDays = 7; // default

      if (shippingInfo) {
        const info = shippingInfo.toLowerCase();

        if (info.includes("overnight")) shippingDays = 1;
        else if (info.includes("1-2")) shippingDays = 2;
        else if (info.includes("3-5")) shippingDays = 5;
        else if (info.includes("1 week")) shippingDays = 7;
        else if (info.includes("2 week")) shippingDays = 14;
        else if (info.includes("1 month")) shippingDays = 30;
      }

      // Calculate delivery date
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + shippingDays);

      const dateStr = deliveryDate.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      return `
        Shipping Info: ${shippingInfo} |
        Delivery to: ${city}, ${state} |
        Expected Date: ${dateStr}
      `;

    } catch (err) {
      return "Error calculating delivery!";
    }
  },
  {
    name: "get_delivery_date",
    description: "Calculate delivery date using product shipping info and customer location. Use after getting product details.",
    schema: z.object({
      city: z.string().describe("Customer city"),
      state: z.string().describe("Customer state"),
      shippingInfo: z.string().describe("Shipping info from product like 'Ships in 1 week'"),
    }),
  }
);

// ── ALL TOOLS ────────────────────────────────────
const tools = [
  searchProductsTool,
  filterByPriceTool,
  getByCategoryTool,
  getBestRatedTool,
  getProductDetailTool,
  getDeliveryDateTool,
];

// ── AGENT ────────────────────────────────────────

// 🆕 location parameter added
export const runAgent = async (userMessage, chatHistory = [], location = null) => {
  try {

    // 🆕 Convert lat/lng → City using OpenStreetMap (Free!)
    let locationContext = "";

    if (location) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&format=json`,
          {
            headers: {
              // Required by OpenStreetMap terms of use
              "User-Agent": "EcommerceChatbot/1.0"
            }
          }
        );

        const geoData = await geoRes.json();
        console.log("All Location data:", geoData)

        // Extract city name from response
        const address = geoData.address;

        const area = address.suburb &&
          address.road ||
          address.city_district ||
          "";

        const city = address.city ||
          address.town ||
          address.village ||
          "Unknown";

        const district = address.county ||
          address.state_district ||
          "";

        const state = address.state || "Unknown";
        const pincode = address.postcode || "";
        const country = address.country || "India";

        // Full address string banao
        const fullAddress = [area, city, district, state, pincode, country]
          .filter(Boolean)  // Empty values hato
          .join(", ");      // Comma se jodo

        console.log(`Customer location: ${fullAddress}`);

        locationContext = `Customer location: ${fullAddress}`;
      } catch (err) {
        console.error("Geocoding error:", err);
        // If geocoding fails, agent will use default delivery estimate
      }
    }

    const agent = await createReactAgent({
      llm,
      tools,
      messageModifier: `
        You are a helpful e-commerce assistant.
        ${locationContext ? locationContext : ""}
        Rules:
          - Answer ALL questions about products, policy, delivery, warranty, shipping
          - Keep the previous conversation in mind
          - Give accurate price, rating, and stock details
          - If customer asks about delivery/shipping of a SPECIFIC product:
            → use get_product_detail tool
            → fetch shippingInformation from product data
            → show real shipping info like "Ships in 1 week"
          - If customer asks about delivery WITHOUT mentioning product:
            → Ask which product they want delivery info for
          - If product stock is 0, mention OUT OF STOCK and suggest alternatives
          - Stay friendly and helpful
          - Keep answers short and clear
          - ONLY use English
          - Do NOT use any other language or script
          - ALWAYS write product names in this format: [Product Name](/products/ID)
          - NEVER use ** ** for bold
          - NEVER use * for bullet points
          - Write each product on one line:
          - Format:  1. [Product Name](/products/ID) - Price: $X | Rating: X | Stock: X
          - If customer asks about delivery, use get_delivery_date tool with their city and state
          - If location is not available, give default delivery estimate of 5-7 business days
      `,
    });
    const result = await agent.invoke({
      messages: [
        // Chat history for memory
        ...chatHistory.map(msg => ({
          role: msg.role === "user" ? "human" : "assistant",
          content: msg.text,
        })),
        // Current user message
        { role: "human", content: userMessage },
      ],
    });

    // Return last message from agent
    const lastMessage = result.messages[result.messages.length - 1];
    return lastMessage.content;
  } catch (error) {
    console.error("Agent Error:", error);
    return "Sorry! Something went wrong.";
  }
};