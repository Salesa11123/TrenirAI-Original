const express = require("express");
const crypto = require("crypto");

const routerFactory = (pool, authMiddleware) => {
  const router = express.Router();

  const safeNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const parseBaseQuantity = (unit) => {
    if (!unit) return 1;
    const match = `${unit}`.match(/([\d.]+)/);
    const parsed = match ? parseFloat(match[1]) : null;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const roundMacro = (value) =>
    Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

  const normalizeTerm = (term) =>
    (term || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const translateToEnglish = (term) => {
    const t = normalizeTerm(term);
    const map = {
      jaje: "egg",
      jaja: "egg",
      piletina: "chicken",
      pile: "chicken",
      pilence: "chicken",
      pirinac: "rice",
      "pirinaÄ": "rice",
      hleb: "bread",
      leb: "bread",
      mleko: "milk",
      mlijeko: "milk",
      sir: "cheese",
      kajmak: "kaymak",
      jogurt: "yogurt",
      meso: "meat",
      jabuka: "apple",
      jabuke: "apple",
      banana: "banana",
      tunjevina: "tuna",
      losos: "salmon",
      pasulj: "beans",
      grasak: "peas",
      krompir: "potato",
      testenina: "pasta",
      testenine: "pasta",
      cokolada: "chocolate",
      "Äokolada": "chocolate",
      voce: "fruit",
      "voÄ‡e": "fruit",
      povrce: "vegetables",
      "povrÄ‡e": "vegetables",
    };
    return map[t] || null;
  };

  // Lightweight external translation fallback (LibreTranslate) with short timeout
  const translationCache = new Map();
  const translateExternal = async (term) => {
    const key = normalizeTerm(term);
    if (!key || key.length < 2) return null;
    if (translationCache.has(key)) return translationCache.get(key);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    try {
      const res = await fetch("https://libretranslate.de/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          q: term,
          source: "auto",
          target: "en",
          format: "text",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("translate non-json response");
      }
      const data = await res.json();
      const translated = normalizeTerm(data?.translatedText || "");
      if (translated) {
        translationCache.set(key, translated);
        return translated;
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error("Translation fallback error:", err.message);
    }
    return null;
  };

  const fallbackSuggestions = [
    { id: "fallback_milk_100ml", name: "Milk 2.8% (100ml)", unit: "100ml", calories: 55, protein: 3, carbs: 4.5, fats: 2.8, source: "fallback" },
    { id: "fallback_egg_1pc", name: "Egg (1 piece)", unit: "1 piece", calories: 70, protein: 6, carbs: 1, fats: 5, source: "fallback" },
    { id: "fallback_chicken_100g", name: "Chicken breast (100g)", unit: "100g", calories: 165, protein: 31, carbs: 0, fats: 3.6, source: "fallback" },
    { id: "fallback_rice_100g", name: "White rice cooked (100g)", unit: "100g", calories: 130, protein: 2.7, carbs: 28, fats: 0.3, source: "fallback" },
    { id: "fallback_oats_50g", name: "Oats (50g)", unit: "50g", calories: 190, protein: 6.5, carbs: 32, fats: 3.5, source: "fallback" },
    { id: "fallback_apple_1pc", name: "Apple (1 medium)", unit: "1 piece", calories: 95, protein: 0.5, carbs: 25, fats: 0.3, source: "fallback" },
  ];

  const normalizeExternalProduct = (product) => {
    const nutriments = product?.nutriments || {};
    const baseUnit = "100g";
    const calories =
      nutriments["energy-kcal_100g"] ??
      nutriments.energy_kcal ??
      nutriments.energy_value;

    const preferredName =
      product.product_name_sr ||
      product.product_name_en ||
      product.product_name ||
      product.generic_name ||
      product.product_name_fr ||
      "Unknown food";

    return {
      id:
        product._id ||
        product.id ||
        product.code ||
        `off_${product.product_name || crypto.randomUUID()}`,
      name: preferredName,
      unit: baseUnit,
      calories: safeNumber(calories),
      protein: safeNumber(nutriments.proteins_100g),
      carbs: safeNumber(nutriments.carbohydrates_100g),
      fats: safeNumber(nutriments.fat_100g),
      source: "openfoodfacts",
    };
  };

  const searchOpenFoodFacts = async (query, scope = "local") => {
    if (!query || query.length < 2) return [];

    const buildUrl = (term, lang = "sr", country = "Serbia") =>
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
        term
      )}&search_simple=1&action=process&json=1&page_size=15&lc=${lang}&lang=${lang}&countries=${country}&fields=product_name,product_name_en,product_name_sr,product_name_fr,nutriments,code,_id,id`;

    const tryFetch = async (term, lang, country) => {
      const url = buildUrl(term, lang, country);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`OFF HTTP ${response.status}`);
        const data = await response.json();
        const products = Array.isArray(data.products) ? data.products : [];
        return products
          .map(normalizeExternalProduct)
          .filter((item) => item.calories || item.protein || item.carbs || item.fats)
          .map((item) => ({
            ...item,
            region: country,
          }));
      } catch (err) {
        clearTimeout(timeout);
        console.error("OFF fetch error:", err.message);
        return [];
      }
    };

    try {
      const steps =
        scope === "global"
          ? [
              { term: query, lang: "sr", country: "Worldwide" },
              { term: query, lang: "en", country: "Worldwide" },
            ]
          : [
              { term: query, lang: "sr", country: "Serbia" },
              { term: query, lang: "sr", country: "Worldwide" },
              { term: query, lang: "en", country: "Worldwide" },
            ];

      for (const step of steps) {
        const results = await tryFetch(step.term, step.lang, step.country);
        if (results.length > 0) return results;
      }

      const translated =
        translateToEnglish(query) || (await translateExternal(query));
      if (translated && translated !== normalizeTerm(query)) {
        const res = await tryFetch(translated, "en", "Worldwide");
        return res;
      }
      return [];
    } catch (err) {
      console.error("Nutrition search OFF error:", err.message);
      return [];
    }
  };

  const searchLocalFoods = async (query) => {
    try {
      const result = await pool.query(
        `
        SELECT id, name, unit, calories, protein, carbs, fats
        FROM food_items
        WHERE LOWER(name) LIKE LOWER($1)
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [`%${query}%`]
      );
      return result.rows.map((row) => ({
        ...row,
        source: "local",
      }));
    } catch (err) {
      console.error("Nutrition search local error:", err.message);
      return [];
    }
  };

  const getUserTargets = async (userId) => {
    const fallback = {
      calories: 2200,
      protein: 140,
      carbs: 240,
      fats: 70,
    };

    const queries = [
      `
      SELECT daily_calorie_target, protein_target, carbs_target, fats_target
      FROM user_profiles
      WHERE "userId" = $1
      LIMIT 1
      `,
      `
      SELECT daily_calorie_target, protein_target, carbs_target, fats_target
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
    ];

    for (const sql of queries) {
      try {
        const result = await pool.query(sql, [userId]);
        if (result.rowCount === 0) continue;
        const row = result.rows[0];
        return {
          calories: row.daily_calorie_target ?? fallback.calories,
          protein: row.protein_target ?? fallback.protein,
          carbs: row.carbs_target ?? fallback.carbs,
          fats: row.fats_target ?? fallback.fats,
        };
      } catch (err) {
        console.error("Nutrition targets lookup error:", err.message);
      }
    }

    return fallback;
  };

  const getDaySummary = async (userId, date) => {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const mealsRes = await pool.query(
      `
      SELECT
        m.*,
        f.name AS food_name,
        f.unit AS food_unit
      FROM meal_entries m
      LEFT JOIN food_items f ON f.id = m.food_item_id
      WHERE m.user_id = $1 AND m.entry_date = $2
      ORDER BY m.created_at DESC
      `,
      [userId, targetDate]
    );

    const totalsRes = await pool.query(
      `
      SELECT
        COALESCE(SUM(calories), 0) AS calories,
        COALESCE(SUM(protein), 0) AS protein,
        COALESCE(SUM(carbs), 0) AS carbs,
        COALESCE(SUM(fats), 0) AS fats
      FROM meal_entries
      WHERE user_id = $1 AND entry_date = $2
      `,
      [userId, targetDate]
    );

    const targets = await getUserTargets(userId);

    return {
      date: targetDate,
      totals: totalsRes.rows[0] || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
      },
      targets,
      meals: mealsRes.rows || [],
    };
  };

  const ensureFoodItem = async (food) => {
    const foodId =
      food?.id || `food_${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
    try {
      await pool.query(
        `
        INSERT INTO food_items (id, name, unit, calories, protein, carbs, fats, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
        ON CONFLICT (id) DO NOTHING
        `,
        [
          foodId,
          food.name,
          food.unit || "1 serving",
          safeNumber(food.calories),
          safeNumber(food.protein),
          safeNumber(food.carbs),
          safeNumber(food.fats),
        ]
      );
    } catch (err) {
      console.error("Nutrition ensureFoodItem error:", err.message);
    }
    return foodId;
  };

  const computeScaledMacros = (food, quantity) => {
    const baseQty = parseBaseQuantity(food?.unit);
    const factor = baseQty ? safeNumber(quantity, 1) / baseQty : safeNumber(quantity, 1);
    return {
      calories: roundMacro(safeNumber(food?.calories) * factor),
      protein: roundMacro(safeNumber(food?.protein) * factor),
      carbs: roundMacro(safeNumber(food?.carbs) * factor),
      fats: roundMacro(safeNumber(food?.fats) * factor),
    };
  };

  const seededShuffle = (arr, seed) => {
    const copy = [...arr];
    let s = seed || 1;
    for (let i = copy.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const pickOne = (arr, seed) => {
    if (!arr || arr.length === 0) return null;
    const shuffled = seededShuffle(arr, seed);
    return shuffled[0];
  };

  const normalizeMealType = (value) => {
    const key = (value || "").toString().toLowerCase();
    const map = {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      snack: "Snacks",
      snacks: "Snacks",
    };
    return map[key] || "Snacks";
  };

  const pickSwap = (list) => {
    if (!list || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  };

  const fetchTemplates = async () => {
    const tplRes = await pool.query(
      `SELECT * FROM meal_plan_templates WHERE status = 'active' ORDER BY created_at ASC`
    );
    const tpls = tplRes.rows || [];
    if (tpls.length === 0) return [];
    const ids = tpls.map((t) => t.id);
    const itemsRes = await pool.query(
      `SELECT * FROM meal_plan_template_items WHERE template_id = ANY($1) ORDER BY order_index ASC, created_at ASC`,
      [ids]
    );
    const byTpl = new Map();
    itemsRes.rows.forEach((row) => {
      if (!byTpl.has(row.template_id)) byTpl.set(row.template_id, []);
      byTpl.get(row.template_id).push(row);
    });
    return tpls.map((t) => ({
      ...t,
      items: byTpl.get(t.id) || [],
    }));
  };

  const pickTemplate = (templates, templateId, seed) => {
    if (templateId) {
      const found = templates.find((t) => t.id === templateId);
      if (found) return found;
    }
    if (!templates || templates.length === 0) return null;
    return pickOne(templates, seed || Date.now());
  };

  const buildPlanFromTemplate = async (userId, date, template) => {
    const targets = await getUserTargets(userId);
    const totalCalories = targets.calories || defaultTargets.calories;
    const totalProtein = targets.protein || defaultTargets.protein;
    const totalCarbs = targets.carbs || defaultTargets.carbs;
    const totalFats = targets.fats || defaultTargets.fats;

    const items = template.items || [];
    const baseTotals = items.reduce(
      (acc, item) => ({
        calories: acc.calories + safeNumber(item.calories),
        protein: acc.protein + safeNumber(item.protein),
        carbs: acc.carbs + safeNumber(item.carbs),
        fats: acc.fats + safeNumber(item.fats),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
    const factor =
      baseTotals.calories > 0 ? safeNumber(totalCalories, 2000) / baseTotals.calories : 1;

    return items.map((item, idx) => ({
      id: crypto.randomUUID(),
      title: item.title,
      meal_type: item.meal_type,
      planned_time: item.planned_time,
      order_index: idx,
      serving_qty: item.serving_qty || 1,
      serving_unit: item.serving_unit || "1 serving",
      description: item.description,
      calories: Math.round(safeNumber(item.calories) * factor),
      protein: Math.round(safeNumber(item.protein) * factor),
      carbs: Math.round(safeNumber(item.carbs) * factor),
      fats: Math.round(safeNumber(item.fats) * factor),
      ingredients: item.ingredients || null,
      applied: false,
      template_item_id: item.id,
    }));
  };

  const buildFallbackPlan = async (userId, date, templateId) => {
    const templates = await fetchTemplates();
    const seedBase = Number((date || "").replace(/-/g, "")) || Date.now();
    const tpl = pickTemplate(templates, templateId, seedBase);
    if (!tpl || !tpl.items || tpl.items.length === 0) {
      // ultimate fallback: empty plan
      return [];
    }
    return buildPlanFromTemplate(userId, date, tpl);
  };

  const getPlanWithItems = async (planId, userId) => {
    const planRes = await pool.query(
      `SELECT * FROM meal_plans WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [planId, userId]
    );
    if (planRes.rowCount === 0) return null;
    const plan = planRes.rows[0];
    const itemsRes = await pool.query(
      `SELECT * FROM meal_plan_items WHERE plan_id = $1 ORDER BY order_index ASC, created_at ASC`,
      [planId]
    );
    plan.items = itemsRes.rows || [];
    return plan;
  };

  const createPlan = async (userId, date, items, templateId) => {
    const insertPlan = await pool.query(
      `INSERT INTO meal_plans (user_id, plan_date, status, note) VALUES ($1,$2,'active','AI template plan') RETURNING *`,
      [userId, date]
    );
    const plan = insertPlan.rows[0];
    for (const item of items) {
      await pool.query(
        `
        INSERT INTO meal_plan_items (
          id, plan_id, title, meal_type, calories, protein, carbs, fats, unit,
          serving_qty, serving_unit, planned_time, description, ingredients, applied, order_index, food_item_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `,
        [
          item.id || crypto.randomUUID(),
          plan.id,
          item.title,
          normalizeMealType(item.meal_type || "snack"),
          safeNumber(item.calories),
          safeNumber(item.protein),
          safeNumber(item.carbs),
          safeNumber(item.fats),
          item.unit || "1 serving",
          safeNumber(item.serving_qty || 1),
          item.serving_unit || item.unit || "1 serving",
          item.planned_time || null,
          item.description || "",
          item.ingredients ? JSON.stringify(item.ingredients) : null,
          item.applied || false,
          safeNumber(item.order_index || 0),
          item.template_item_id || null,
        ]
      );
    }
    return getPlanWithItems(plan.id, userId);
  };

  const getOrCreatePlan = async (userId, date, templateId) => {
    const planDate = date || new Date().toISOString().slice(0, 10);
    const existing = await pool.query(
      `SELECT id FROM meal_plans WHERE user_id = $1 AND plan_date = $2 LIMIT 1`,
      [userId, planDate]
    );
    if (existing.rowCount > 0) {
      return getPlanWithItems(existing.rows[0].id, userId);
    }
    const fallbackItems = await buildFallbackPlan(userId, planDate, templateId);
    return createPlan(userId, planDate, fallbackItems, templateId);
  };

  router.get("/search", authMiddleware, async (req, res) => {
    const query = req.query.q || "";
    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }

    const scope = req.query.scope === "global" ? "global" : "local";

    const [externalResults, localResults] = await Promise.all([
      searchOpenFoodFacts(query, scope),
      searchLocalFoods(query),
    ]);

    const combined = [...externalResults, ...localResults];

    const map = new Map();
    combined.forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    });

    let results = Array.from(map.values());

    if (results.length === 0) {
      const nq = normalizeTerm(query);
      const suggestions = fallbackSuggestions.filter((s) => {
        const name = normalizeTerm(s.name);
        return name.includes(nq) || nq.includes(name);
      });
      results = suggestions;
    }

    return res.json({ results });
  });

  router.get("/today", authMiddleware, async (req, res) => {
    try {
      const date = req.query.date;
      const summary = await getDaySummary(req.user.id, date);
      return res.json(summary);
    } catch (err) {
      console.error("Nutrition today error:", err.message);
      return res.status(500).json({ error: "Failed to load nutrition summary" });
    }
  });

  router.get("/templates", authMiddleware, async (_req, res) => {
    try {
      const templates = await fetchTemplates();
      return res.json({ templates });
    } catch (err) {
      console.error("Nutrition templates error:", err.message);
      return res.status(500).json({ error: "Failed to load templates" });
    }
  });

  router.get("/plan", authMiddleware, async (req, res) => {
    try {
      const date = req.query.date || new Date().toISOString().slice(0, 10);
      const templateId = req.query.templateId || req.query.template_id;
      const plan = await getOrCreatePlan(req.user.id, date, templateId);
      return res.json({
        plan: {
          id: plan.id,
          plan_date: plan.plan_date,
          status: plan.status,
          note: plan.note,
        },
        items: plan.items || [],
      });
    } catch (err) {
      console.error("Nutrition plan get error:", err.message);
      return res.status(500).json({ error: "Failed to load plan" });
    }
  });

  router.post("/plan/:planId/items/:itemId/apply", authMiddleware, async (req, res) => {
    try {
      const { planId, itemId } = req.params;
      if (!planId || !itemId) return res.status(400).json({ error: "Missing plan or item id" });

      const itemRes = await pool.query(
        `
        SELECT i.*, p.plan_date
        FROM meal_plan_items i
        JOIN meal_plans p ON p.id = i.plan_id
        WHERE i.id = $1 AND i.plan_id = $2 AND p.user_id = $3
        LIMIT 1
        `,
        [itemId, planId, req.user.id]
      );
      if (itemRes.rowCount === 0) {
        return res.status(404).json({ error: "Plan item not found" });
      }
      const item = itemRes.rows[0];

      await pool.query(
        `UPDATE meal_plan_items SET applied = true WHERE id = $1 AND plan_id = $2`,
        [itemId, planId]
      );

      // Log into existing nutrition flow
      const baseFood = {
        id: item.food_item_id || item.id,
        name: item.title,
        unit: item.serving_unit || item.unit || "1 serving",
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
      };
      const quantity = safeNumber(item.serving_qty || 1, 1);
      const scaled = computeScaledMacros(baseFood, quantity);
      const payload = {
        foodItemId: baseFood.id,
        foodName: baseFood.name,
        unit: baseFood.unit,
        calories: baseFood.calories,
        protein: baseFood.protein,
        carbs: baseFood.carbs,
        fats: baseFood.fats,
        quantity,
        mealType: item.meal_type || "snack",
        consumedAt: item.plan_date,
      };

      // Reuse log endpoint logic
      try {
        const insert = await pool.query(
          `
          INSERT INTO meal_entries (
            user_id, food_item_id, quantity, calories, protein, carbs, fats, meal_type, entry_date, created_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
          RETURNING *
          `,
          [
            req.user.id,
            await ensureFoodItem(baseFood),
            safeNumber(payload.quantity),
            scaled.calories,
            scaled.protein,
            scaled.carbs,
            scaled.fats,
            normalizeMealType(payload.mealType),
            payload.consumedAt || new Date().toISOString().slice(0, 10),
          ]
        );
        const entry = insert.rows[0];
        entry.food_name = baseFood.name;
        entry.food_unit = baseFood.unit;
      } catch (err) {
        console.error("Plan apply log error:", err.message);
      }

      const updatedPlan = await getPlanWithItems(planId, req.user.id);
      const summary = await getDaySummary(req.user.id, item.plan_date);
      return res.json({
        plan: {
          id: updatedPlan.id,
          plan_date: updatedPlan.plan_date,
          status: updatedPlan.status,
          note: updatedPlan.note,
        },
        items: updatedPlan.items || [],
        summary,
      });
    } catch (err) {
      console.error("Nutrition plan apply error:", err.message);
      return res.status(500).json({ error: "Failed to apply plan item" });
    }
  });

  router.post("/plan/:planId/items/:itemId/swap", authMiddleware, async (req, res) => {
    try {
      const { planId, itemId } = req.params;
      if (!planId || !itemId) return res.status(400).json({ error: "Missing plan or item id" });

      const itemRes = await pool.query(
        `
        SELECT i.*, p.plan_date, i.meal_type
        FROM meal_plan_items i
        JOIN meal_plans p ON p.id = i.plan_id
        WHERE i.id = $1 AND i.plan_id = $2 AND p.user_id = $3
        LIMIT 1
        `,
        [itemId, planId, req.user.id]
      );
      if (itemRes.rowCount === 0) {
        return res.status(404).json({ error: "Plan item not found" });
      }
      const item = itemRes.rows[0];
      const templates = await fetchTemplates();
      const swapCandidates = templates
        .flatMap((tpl) =>
          (tpl.items || []).filter(
            (x) => (x.meal_type || "").toLowerCase() === (item.meal_type || "").toLowerCase()
          )
        )
        .filter((x) => x.id !== item.template_item_id);
      const suggestion = pickSwap(swapCandidates) || {
        title: `${item.title} alt`,
        description: "Nova varijanta",
        calories: item.calories || 400,
        protein: item.protein || 25,
        carbs: item.carbs || 30,
        fats: item.fats || 12,
        serving_qty: item.serving_qty || 1,
        serving_unit: item.serving_unit || item.unit || "1 serving",
      };

      await pool.query(
        `
        UPDATE meal_plan_items
        SET
          title = $1,
          description = $2,
          calories = $3,
          protein = $4,
          carbs = $5,
          fats = $6,
          serving_qty = $7,
          serving_unit = $8,
          ingredients = $9,
          applied = false
        WHERE id = $10 AND plan_id = $11
        `,
        [
          suggestion.title,
          suggestion.description || item.description || "",
          safeNumber(suggestion.calories || item.calories),
          safeNumber(suggestion.protein || item.protein),
          safeNumber(suggestion.carbs || item.carbs),
          safeNumber(suggestion.fats || item.fats),
          safeNumber(suggestion.serving_qty || item.serving_qty || 1),
          suggestion.serving_unit || item.serving_unit || item.unit || "1 serving",
          suggestion.ingredients ? JSON.stringify(suggestion.ingredients) : item.ingredients,
          itemId,
          planId,
        ]
      );

      const updatedPlan = await getPlanWithItems(planId, req.user.id);
      return res.json({
        plan: {
          id: updatedPlan.id,
          plan_date: updatedPlan.plan_date,
          status: updatedPlan.status,
          note: updatedPlan.note,
        },
        items: updatedPlan.items || [],
      });
    } catch (err) {
      console.error("Nutrition plan swap error:", err.message);
      return res.status(500).json({ error: "Failed to swap plan item" });
    }
  });

  router.post("/log", authMiddleware, async (req, res) => {
    try {
      const {
        foodItemId,
        foodName,
        unit = "1 serving",
        calories,
        protein,
        carbs,
        fats,
        quantity = 1,
        mealType = "breakfast",
        consumedAt,
      } = req.body;

      if (!foodName || !quantity || Number(quantity) <= 0) {
        return res.status(400).json({ error: "Food name and quantity are required" });
      }

      const baseFood = {
        id: foodItemId,
        name: foodName,
        unit,
        calories,
        protein,
        carbs,
        fats,
      };

      const foodId = await ensureFoodItem(baseFood);
      const scaled = computeScaledMacros(baseFood, quantity);
      const date = consumedAt
        ? new Date(consumedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const mealTypeValue = normalizeMealType(mealType);

      const insert = await pool.query(
        `
        INSERT INTO meal_entries (
          user_id, food_item_id, quantity, calories, protein, carbs, fats, meal_type, entry_date, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        RETURNING *
        `,
        [
          req.user.id,
          foodId,
          safeNumber(quantity),
          scaled.calories,
          scaled.protein,
          scaled.carbs,
          scaled.fats,
          mealTypeValue,
          date,
        ]
      );

      const entry = insert.rows[0];
      entry.food_name = foodName;
      entry.food_unit = unit;

      const summary = await getDaySummary(req.user.id, date);
      return res.json({ entry, summary });
    } catch (err) {
      console.error("Nutrition log error:", err.message);
      return res.status(500).json({ error: "Failed to log meal" });
    }
  });

  router.delete("/log/:id", authMiddleware, async (req, res) => {
    try {
      const entryId = req.params.id;
      if (!entryId) return res.status(400).json({ error: "Missing entry id" });

      const existing = await pool.query(
        `SELECT entry_date FROM meal_entries WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [entryId, req.user.id]
      );
      if (existing.rowCount === 0) {
        return res.status(404).json({ error: "Meal entry not found" });
      }
      const entryDate = existing.rows[0].entry_date;

      await pool.query(`DELETE FROM meal_entries WHERE id = $1 AND user_id = $2`, [
        entryId,
        req.user.id,
      ]);

      const summary = await getDaySummary(req.user.id, entryDate);
      return res.json({ success: true, summary });
    } catch (err) {
      console.error("Nutrition delete error:", err.message);
      return res.status(500).json({ error: "Failed to delete meal" });
    }
  });

  return router;
};

module.exports = routerFactory;
